import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { Hono } from 'hono';
import { prisma, decryptContent, decryptEmbeddingInputs } from '@synapse/dal';
import {
    createApiKeySchema,
    updateApiKeySchema,
    logsQuerySchema,
    analyticsQuerySchema,
    embeddingLogsQuerySchema,
    embeddingAnalyticsQuerySchema,
    HTTP_STATUS,
    type ApiKeyResponse,
    type ApiKeyCreatedResponse,
    type ApiKeyListResponse,
    type ProvidersResponse,
    type RequestLogItem,
    type RequestLogDetail,
    type RequestLogListResponse,
    type AnalyticsRange,
    type AnalyticsResponse,
    type EmbeddingAnalyticsResponse,
} from '@synapse/shared';
import {
    providers,
    getChatDeployments,
    getDefaultChatModel,
    getDefaultEmbeddingModel,
    getEmbeddingDeployments,
    type ProviderName,
} from '../config/providers.js';
import { providerRegistry } from '../services/provider-registry.js';

const admin = new Hono();

// Helper to format API key response
const formatApiKeyResponse = (apiKey: {
    id: string;
    name: string;
    userId: string | null;
    rateLimit: number;
    enabled: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
}): ApiKeyResponse => ({
    id: apiKey.id,
    name: apiKey.name,
    userId: apiKey.userId,
    rateLimit: apiKey.rateLimit,
    enabled: apiKey.enabled,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
});

// API key version - increment when key format changes
const API_KEY_VERSION = 'v1';

// Lowercase alphanumeric characters (like OpenRouter)
const ALPHANUMERIC_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

// Generate a secure API key with versioned format: sk-syn-v1-{randomPart}
// randomPart contains only lowercase letters and numbers (like OpenRouter)
const generateApiKey = (): string => {
    const prefix = `sk-syn-${API_KEY_VERSION}`;
    const bytes = randomBytes(48);
    let randomPart = '';
    for (let i = 0; i < 48; i++) {
        randomPart += ALPHANUMERIC_CHARS[bytes[i]! % ALPHANUMERIC_CHARS.length];
    }
    return `${prefix}-${randomPart}`;
};

const getStartDateFromRange = (range: AnalyticsRange): Date => {
    const startDate = new Date();

    switch (range) {
        case '15m':
            startDate.setMinutes(startDate.getMinutes() - 15);
            break;
        case '1h':
            startDate.setHours(startDate.getHours() - 1);
            break;
        case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
        case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
    }

    return startDate;
};

const getTimeKey = (range: AnalyticsRange, date: Date): string => {
    if (range === '15m' || range === '1h') {
        return date.toISOString().slice(0, 16) + ':00Z';
    }

    if (range === '24h') {
        return date.toISOString().slice(0, 13) + ':00:00Z';
    }

    return date.toISOString().slice(0, 10);
};

const calculatePercentile = (arr: number[], percentile: number): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? null;
};

// List all API keys
admin.get('/api-keys', async (c) => {
    const apiKeys = await prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    const response: ApiKeyListResponse = {
        data: apiKeys.map(formatApiKeyResponse),
        total: apiKeys.length,
    };

    return c.json(response);
});

// Get single API key
admin.get('/api-keys/:id', async (c) => {
    const { id } = c.req.param();

    const apiKey = await prisma.apiKey.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    if (!apiKey) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND,
        );
    }

    return c.json(formatApiKeyResponse(apiKey));
});

// Create new API key
admin.post('/api-keys', async (c) => {
    const body = await c.req.json();
    const parsed = createApiKeySchema.safeParse(body);

    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid request body',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const { name, userId, rateLimit, expiresAt } = parsed.data;

    // Generate plaintext key and hash it
    const plaintextKey = generateApiKey();
    const hashedKey = await bcrypt.hash(plaintextKey, 10);

    const apiKey = await prisma.apiKey.create({
        data: {
            key: hashedKey,
            name,
            userId,
            rateLimit,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    const response: ApiKeyCreatedResponse = {
        ...formatApiKeyResponse(apiKey),
        key: plaintextKey, // Only returned on creation
    };

    return c.json(response, HTTP_STATUS.OK);
});

// Update API key
admin.patch('/api-keys/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updateApiKeySchema.safeParse(body);

    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid request body',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    // Check if key exists
    const existing = await prisma.apiKey.findUnique({
        where: { id },
    });

    if (!existing) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND,
        );
    }

    const { name, rateLimit, enabled, expiresAt } = parsed.data;

    const apiKey = await prisma.apiKey.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(rateLimit !== undefined && { rateLimit }),
            ...(enabled !== undefined && { enabled }),
            ...(expiresAt !== undefined && {
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
        },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    return c.json(formatApiKeyResponse(apiKey));
});

// Delete API key
admin.delete('/api-keys/:id', async (c) => {
    const { id } = c.req.param();

    // Check if key exists
    const existing = await prisma.apiKey.findUnique({
        where: { id },
    });

    if (!existing) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND,
        );
    }

    await prisma.apiKey.delete({
        where: { id },
    });

    return c.json({ message: 'API key deleted successfully' });
});

// GET /admin/providers - List available providers and their models
admin.get('/providers', (c) => {
    const response: ProvidersResponse = {
        providers: providers.map(provider => ({
            id: provider.id,
            name: provider.name,
            available: providerRegistry.hasProvider(provider.id),
            chatModels: getChatDeployments(provider.id).map(deployment => deployment.modelId),
            defaultChatModel: getDefaultChatModel(provider.id),
            embeddingModels: getEmbeddingDeployments(provider.id).map(deployment => deployment.modelId),
            defaultEmbeddingModel: getDefaultEmbeddingModel(provider.id),
        })),
    };

    return c.json(response);
});

// GET /admin/logs - List request logs with pagination and filters
admin.get('/logs', async (c) => {
    const queryParams = {
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        provider: c.req.query('provider'),
        model: c.req.query('model'),
        cached: c.req.query('cached'),
        startDate: c.req.query('startDate'),
        endDate: c.req.query('endDate'),
        apiKeyId: c.req.query('apiKeyId'),
    };

    const parsed = logsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid query parameters',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const { page, limit, provider, model, cached, startDate, endDate, apiKeyId } = parsed.data;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (provider) where.provider = provider;
    if (model) where.model = model;
    if (cached !== undefined) where.cached = cached === 'true';
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
        prisma.requestLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                apiKeyId: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
                cached: true,
                cacheType: true,
                cacheTtl: true,
                costSaving: true,
                latencySaving: true,
                latency: true,
                statusCode: true,
                createdAt: true,
            },
        }),
        prisma.requestLog.count({ where }),
    ]);

    const response: RequestLogListResponse = {
        data: logs.map((log): RequestLogItem => ({
            id: log.id,
            apiKeyId: log.apiKeyId,
            provider: log.provider,
            model: log.model,
            inputTokens: log.inputTokens,
            outputTokens: log.outputTokens,
            totalTokens: log.totalTokens,
            cached: log.cached,
            cacheType: log.cacheType as RequestLogItem['cacheType'],
            cacheTtl: log.cacheTtl,
            costSaving: log.costSaving,
            latencySaving: log.latencySaving,
            latency: log.latency,
            statusCode: log.statusCode,
            createdAt: log.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };

    return c.json(response);
});

// GET /admin/logs/analytics - Get aggregated analytics data
admin.get('/logs/analytics', async (c) => {
    const queryParams = {
        range: c.req.query('range') || '24h',
        apiKeyId: c.req.query('apiKeyId'),
        cacheMissOnly: c.req.query('cacheMissOnly'),
    };

    const parsed = analyticsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid query parameters',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const { range, apiKeyId, cacheMissOnly } = parsed.data;

    const now = new Date();
    const startDate = getStartDateFromRange(range);
    const baseWhere: Record<string, unknown> = {
        createdAt: { gte: startDate, lte: now },
    };

    if (apiKeyId) {
        baseWhere.apiKeyId = apiKeyId;
    }

    if (cacheMissOnly) {
        baseWhere.cached = false;
    }

    const where = {
        ...baseWhere,
        statusCode: 200,
    };

    // Get all successful logs in range for aggregation
    const [logs, totalResponses] = await Promise.all([
        prisma.requestLog.findMany({
            where,
            select: {
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                totalTokens: true,
                cached: true,
                latency: true,
                createdAt: true,
            },
        }),
        prisma.requestLog.count({ where: baseWhere }),
    ]);

    const totalRequests = logs.length;
    const successRate = totalResponses > 0 ? (totalRequests / totalResponses) * 100 : 0;
    const cachedRequests = logs.filter(l => l.cached).length;
    const cacheHitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;

    const uniqueProviders = new Set(logs.map(l => l.provider)).size;
    const uniqueModels = new Set(logs.map(l => l.model)).size;

    const latencies = logs.filter(l => l.latency !== null).map(l => l.latency!);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null;

    const totalInputTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0), 0);
    const totalOutputTokens = logs.reduce((sum, l) => sum + (l.outputTokens || 0), 0);
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

    // Provider stats
    const providerCounts = logs.reduce((acc, l) => {
        acc[l.provider] = (acc[l.provider] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const providerStats = Object.entries(providerCounts).map(([provider, count]) => ({
        provider,
        count,
        percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
    }));

    // Model stats
    const modelData = logs.reduce((acc, l) => {
        const key = `${l.provider}:${l.model}`;
        if (!acc[key]) {
            acc[key] = { provider: l.provider, model: l.model, count: 0, latencies: [] as number[] };
        }
        acc[key].count++;
        if (l.latency !== null) acc[key].latencies.push(l.latency);
        return acc;
    }, {} as Record<string, { provider: string; model: string; count: number; latencies: number[] }>);

    const modelStats = Object.values(modelData).map(m => ({
        model: m.model,
        provider: m.provider,
        count: m.count,
        avgLatency: m.latencies.length > 0
            ? m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length
            : null,
    }));

    // Token usage over time (group by minute, hour, or day depending on range)
    const tokenUsageMap = logs.reduce((acc, l) => {
        const key = getTimeKey(range, new Date(l.createdAt));
        if (!acc[key]) {
            acc[key] = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        }
        acc[key].inputTokens += l.inputTokens || 0;
        acc[key].outputTokens += l.outputTokens || 0;
        acc[key].totalTokens += l.totalTokens || 0;
        return acc;
    }, {} as Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>);

    const tokenUsageOverTime = Object.entries(tokenUsageMap)
        .map(([date, tokens]) => ({ date, ...tokens }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Requests over time (time series)
    const requestsMap = logs.reduce((acc, l) => {
        const key = getTimeKey(range, new Date(l.createdAt));
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const requestsOverTime = Object.entries(requestsMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Latency over time with percentiles (time series)
    const latencyByTimeMap = logs.reduce((acc, l) => {
        if (l.latency === null) return acc;
        const key = getTimeKey(range, new Date(l.createdAt));
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(l.latency);
        return acc;
    }, {} as Record<string, number[]>);

    const latencyOverTime = Object.entries(latencyByTimeMap)
        .map(([date, latencies]) => ({
            date,
            p50: calculatePercentile(latencies, 50),
            p90: calculatePercentile(latencies, 90),
            p99: calculatePercentile(latencies, 99),
            avg: latencies.length > 0
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                : null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Model latency stats with percentiles
    const modelLatencyStats = Object.values(modelData).map(m => ({
        model: m.model,
        provider: m.provider,
        count: m.count,
        p50: calculatePercentile(m.latencies, 50),
        p90: calculatePercentile(m.latencies, 90),
        p99: calculatePercentile(m.latencies, 99),
        avg: m.latencies.length > 0
            ? m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length
            : null,
    }));

    const response: AnalyticsResponse = {
        totalRequests,
        totalResponses,
        successRate,
        cacheHitRate,
        uniqueProviders,
        uniqueModels,
        avgLatency,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        providerStats,
        modelStats,
        tokenUsageOverTime,
        requestsOverTime,
        latencyOverTime,
        modelLatencyStats,
    };

    return c.json(response);
});

// ============================================================
// Embedding Provider Endpoints
// ============================================================

// GET /admin/providers/embedding - List providers that support embeddings
admin.get('/providers/embedding', (c) => {
    const availableProviders = new Set(providerRegistry.getAvailableEmbeddingProviders());

    return c.json({
        providers: providers
            .filter(provider => getEmbeddingDeployments(provider.id).length > 0)
            .map(provider => ({
                id: provider.id,
                name: provider.name,
                available: availableProviders.has(provider.id as ProviderName),
                chatModels: getChatDeployments(provider.id).map(deployment => deployment.modelId),
                defaultChatModel: getDefaultChatModel(provider.id),
                embeddingModels: getEmbeddingDeployments(provider.id).map(deployment => deployment.modelId),
                defaultEmbeddingModel: getDefaultEmbeddingModel(provider.id),
            })),
    });
});

// ============================================================
// Embedding Log Endpoints
// NOTE: These must be registered BEFORE /logs/:id to avoid
// "embeddings" being captured as an :id parameter.
// ============================================================

// GET /admin/logs/embeddings/analytics - Get embedding analytics data
admin.get('/logs/embeddings/analytics', async (c) => {
    const queryParams = {
        range: c.req.query('range') || '24h',
        apiKeyId: c.req.query('apiKeyId'),
    };

    const parsed = embeddingAnalyticsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid query parameters',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const { range, apiKeyId } = parsed.data;

    const now = new Date();
    const startDate = getStartDateFromRange(range);
    const baseWhere: Record<string, unknown> = {
        createdAt: { gte: startDate, lte: now },
    };

    if (apiKeyId) {
        baseWhere.apiKeyId = apiKeyId;
    }

    const where = {
        ...baseWhere,
        statusCode: 200,
    };

    // Fetch all successful logs in range for aggregation
    const [logs, totalResponses] = await Promise.all([
        prisma.embeddingLog.findMany({
            where,
            select: {
                provider: true,
                model: true,
                tokens: true,
                latency: true,
                createdAt: true,
            },
        }),
        prisma.embeddingLog.count({ where: baseWhere }),
    ]);

    const totalRequests = logs.length;
    const successRate = totalResponses > 0 ? (totalRequests / totalResponses) * 100 : 0;
    const uniqueProviders = new Set(logs.map(l => l.provider)).size;
    const uniqueModels = new Set(logs.map(l => l.model)).size;

    const totalTokens = logs.reduce((sum, l) => sum + (l.tokens || 0), 0);
    const latencies = logs.filter(l => l.latency !== null).map(l => l.latency!);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null;

    // Provider stats
    const providerCounts = logs.reduce((acc, l) => {
        acc[l.provider] = (acc[l.provider] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const providerTokens = logs.reduce((acc, l) => {
        acc[l.provider] = (acc[l.provider] || 0) + (l.tokens || 0);
        return acc;
    }, {} as Record<string, number>);

    const providerStats = Object.entries(providerCounts).map(([provider, count]) => ({
        provider,
        count,
        percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
        totalTokens: providerTokens[provider] || 0,
    }));

    // Model stats
    const modelData = logs.reduce((acc, l) => {
        const key = `${l.provider}:${l.model}`;
        if (!acc[key]) {
            acc[key] = { provider: l.provider, model: l.model, count: 0, latencies: [] as number[], tokens: 0 };
        }
        acc[key].count++;
        acc[key].tokens += l.tokens || 0;
        if (l.latency !== null) acc[key].latencies.push(l.latency);
        return acc;
    }, {} as Record<string, { provider: string; model: string; count: number; latencies: number[]; tokens: number }>);

    const modelStats = Object.values(modelData).map(m => ({
        model: m.model,
        provider: m.provider,
        count: m.count,
        avgLatency: m.latencies.length > 0
            ? m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length
            : null,
        totalTokens: m.tokens,
    }));

    // Token usage over time
    const tokenUsageMap = logs.reduce((acc, l) => {
        const key = getTimeKey(range, new Date(l.createdAt));
        if (!acc[key]) {
            acc[key] = { tokens: 0, count: 0 };
        }
        acc[key].tokens += l.tokens || 0;
        acc[key].count++;
        return acc;
    }, {} as Record<string, { tokens: number; count: number }>);

    const tokenUsageOverTime = Object.entries(tokenUsageMap)
        .map(([date, data]) => ({ date, tokens: data.tokens, count: data.count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Latency over time with percentiles
    const latencyByTimeMap = logs.reduce((acc, l) => {
        if (l.latency === null) return acc;
        const key = getTimeKey(range, new Date(l.createdAt));
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(l.latency);
        return acc;
    }, {} as Record<string, number[]>);

    const latencyOverTime = Object.entries(latencyByTimeMap)
        .map(([date, lats]) => ({
            date,
            p50: calculatePercentile(lats, 50),
            p90: calculatePercentile(lats, 90),
            p99: calculatePercentile(lats, 99),
            avg: lats.length > 0
                ? lats.reduce((a, b) => a + b, 0) / lats.length
                : null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const response: EmbeddingAnalyticsResponse = {
        totalRequests,
        totalResponses,
        successRate,
        totalTokens,
        avgLatency,
        uniqueProviders,
        uniqueModels,
        providerStats,
        modelStats,
        tokenUsageOverTime,
        latencyOverTime,
    };

    return c.json(response);
});

// GET /admin/logs/embeddings - List embedding logs with pagination and filters
admin.get('/logs/embeddings', async (c) => {
    const queryParams = {
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        provider: c.req.query('provider'),
        model: c.req.query('model'),
        startDate: c.req.query('startDate'),
        endDate: c.req.query('endDate'),
        apiKeyId: c.req.query('apiKeyId'),
    };

    const parsed = embeddingLogsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid query parameters',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    const { page, limit, provider, model, startDate, endDate, apiKeyId } = parsed.data;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (provider) where.provider = provider;
    if (model) where.model = model;
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
        prisma.embeddingLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                apiKeyId: true,
                provider: true,
                model: true,
                inputCount: true,
                dimensions: true,
                requestContent: true,
                requestContentIv: true,
                requestContentTag: true,
                tokens: true,
                latency: true,
                statusCode: true,
                createdAt: true,
            },
        }),
        prisma.embeddingLog.count({ where }),
    ]);

    return c.json({
        logs: logs.map((log) => {
            const inputs = decryptEmbeddingInputs(
                log.requestContent,
                log.requestContentIv,
                log.requestContentTag,
            );
            return {
                id: log.id,
                apiKeyId: log.apiKeyId,
                provider: log.provider,
                model: log.model,
                inputCount: log.inputCount,
                dimensions: log.dimensions,
                requestContent: inputs ? JSON.stringify(inputs) : null,
                tokens: log.tokens,
                latency: log.latency,
                statusCode: log.statusCode,
                createdAt: log.createdAt.toISOString(),
            };
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
});

// GET /admin/logs/embeddings/:id - Get single embedding log detail
admin.get('/logs/embeddings/:id', async (c) => {
    const { id } = c.req.param();

    const log = await prisma.embeddingLog.findUnique({
        where: { id },
        include: {
            apiKey: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!log) {
        return c.json(
            { error: 'Not Found', message: 'Embedding log not found' },
            HTTP_STATUS.NOT_FOUND,
        );
    }

    const inputs = decryptEmbeddingInputs(
        log.requestContent,
        log.requestContentIv,
        log.requestContentTag,
    );

    return c.json({
        id: log.id,
        apiKeyId: log.apiKeyId,
        apiKey: log.apiKey,
        provider: log.provider,
        model: log.model,
        inputCount: log.inputCount,
        dimensions: log.dimensions,
        requestContent: inputs ? JSON.stringify(inputs) : null,
        tokens: log.tokens,
        latency: log.latency,
        statusCode: log.statusCode,
        createdAt: log.createdAt.toISOString(),
    });
});

// GET /admin/logs/:id - Get single log with decrypted content
admin.get('/logs/:id', async (c) => {
    const { id } = c.req.param();

    const log = await prisma.requestLog.findUnique({
        where: { id },
    });

    if (!log) {
        return c.json(
            { error: 'Not Found', message: 'Request log not found' },
            HTTP_STATUS.NOT_FOUND,
        );
    }

    // Decrypt content if available
    const decrypted = decryptContent(
        log.promptContent,
        log.responseContent,
        log.contentIv,
        log.contentTag,
    );

    const response: RequestLogDetail = {
        id: log.id,
        apiKeyId: log.apiKeyId,
        provider: log.provider,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        cached: log.cached,
        cacheType: log.cacheType as RequestLogDetail['cacheType'],
        cacheTtl: log.cacheTtl,
        costSaving: log.costSaving,
        latencySaving: log.latencySaving,
        latency: log.latency,
        statusCode: log.statusCode,
        createdAt: log.createdAt.toISOString(),
        promptMessages: decrypted.promptMessages,
        responseContent: decrypted.responseText,
    };

    return c.json(response);
});

export { admin };
