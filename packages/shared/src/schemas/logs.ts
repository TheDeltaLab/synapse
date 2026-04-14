import { z } from 'zod';

// Cache type enum
export const cacheTypeSchema = z.enum(['semantic', 'exact', 'none']);
export type CacheType = z.infer<typeof cacheTypeSchema>;

// Request log item (for list view - no content)
export const requestLogItemSchema = z.object({
    id: z.string().uuid(),
    apiKeyId: z.string().uuid(),
    provider: z.string(),
    model: z.string(),
    inputTokens: z.number().nullable(),
    outputTokens: z.number().nullable(),
    totalTokens: z.number().nullable(),
    cached: z.boolean(),
    cacheType: cacheTypeSchema.nullable(),
    cacheTtl: z.number().nullable(),
    costSaving: z.number().nullable(),
    latencySaving: z.number().nullable(),
    latency: z.number().nullable(),
    statusCode: z.number(),
    createdAt: z.string().datetime(),
});

export type RequestLogItem = z.infer<typeof requestLogItemSchema>;

// Chat message schema for decrypted content
export const chatMessageContentSchema = z.object({
    role: z.string(),
    content: z.string(),
});

export type ChatMessageContent = z.infer<typeof chatMessageContentSchema>;

// Request log detail (with decrypted content)
export const requestLogDetailSchema = requestLogItemSchema.extend({
    promptMessages: z.array(chatMessageContentSchema).nullable(),
    responseContent: z.string().nullable(),
});

export type RequestLogDetail = z.infer<typeof requestLogDetailSchema>;

// Paginated list response
export const requestLogListResponseSchema = z.object({
    data: z.array(requestLogItemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
});

export type RequestLogListResponse = z.infer<typeof requestLogListResponseSchema>;

// Query params for listing logs
export const logsQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    provider: z.string().optional(),
    model: z.string().optional(),
    cached: z.enum(['true', 'false']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    apiKeyId: z.string().uuid().optional(),
});

export type LogsQuery = z.infer<typeof logsQuerySchema>;

// Time range for analytics
export const analyticsRangeSchema = z.enum(['15m', '1h', '24h', '7d', '30d']);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

// Provider stats
export const providerStatsSchema = z.object({
    provider: z.string(),
    count: z.number(),
    percentage: z.number(),
});

export type ProviderStats = z.infer<typeof providerStatsSchema>;

// Model stats
export const modelStatsSchema = z.object({
    model: z.string(),
    provider: z.string(),
    count: z.number(),
    avgLatency: z.number().nullable(),
});

export type ModelStats = z.infer<typeof modelStatsSchema>;

// Token usage over time
export const tokenUsagePointSchema = z.object({
    date: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
});

export type TokenUsagePoint = z.infer<typeof tokenUsagePointSchema>;

// Requests over time (time series)
export const requestsOverTimePointSchema = z.object({
    date: z.string(),
    count: z.number(),
});

export type RequestsOverTimePoint = z.infer<typeof requestsOverTimePointSchema>;

// Latency over time with percentiles (time series)
export const latencyOverTimePointSchema = z.object({
    date: z.string(),
    p50: z.number().nullable(),
    p90: z.number().nullable(),
    p99: z.number().nullable(),
    avg: z.number().nullable(),
});

export type LatencyOverTimePoint = z.infer<typeof latencyOverTimePointSchema>;

// Latency percentiles by model
export const modelLatencyStatsSchema = z.object({
    model: z.string(),
    provider: z.string(),
    p50: z.number().nullable(),
    p90: z.number().nullable(),
    p99: z.number().nullable(),
    avg: z.number().nullable(),
    count: z.number(),
});

export type ModelLatencyStats = z.infer<typeof modelLatencyStatsSchema>;

// Analytics response
export const analyticsResponseSchema = z.object({
    totalRequests: z.number(),
    totalResponses: z.number(),
    successRate: z.number(),
    cacheHitRate: z.number(),
    uniqueProviders: z.number(),
    uniqueModels: z.number(),
    avgLatency: z.number().nullable(),
    totalTokens: z.number(),
    totalInputTokens: z.number(),
    totalOutputTokens: z.number(),
    providerStats: z.array(providerStatsSchema),
    modelStats: z.array(modelStatsSchema),
    tokenUsageOverTime: z.array(tokenUsagePointSchema),
    requestsOverTime: z.array(requestsOverTimePointSchema),
    latencyOverTime: z.array(latencyOverTimePointSchema),
    modelLatencyStats: z.array(modelLatencyStatsSchema),
});

export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;

const booleanQueryParamSchema = z.preprocess((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}, z.boolean());

// Analytics query params
export const analyticsQuerySchema = z.object({
    range: analyticsRangeSchema.default('24h'),
    apiKeyId: z.string().uuid().optional(),
    cacheMissOnly: booleanQueryParamSchema.optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
