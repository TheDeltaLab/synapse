import { z } from 'zod';

// ============================================================
// Request Schema
// ============================================================

/**
 * Embedding request schema (OpenAI compatible format)
 * @see https://platform.openai.com/docs/api-reference/embeddings/create
 */
export const embeddingRequestSchema = z.object({
    /** Model ID, e.g. text-embedding-3-small */
    model: z.string().min(1),

    /** Input text, supports single string or array of strings */
    input: z.union([
        z.string().min(1),
        z.array(z.string().min(1)).min(1).max(2048), // OpenAI limits max 2048 inputs
    ]),

    /** Output format: float (array) or base64 (encoded string) */
    encoding_format: z.enum(['float', 'base64']).optional().default('float'),

    /** Output dimensions (only supported by some models, e.g. text-embedding-3-*) */
    dimensions: z.number().int().positive().max(3072).optional(),

    /** User identifier (for tracking) */
    user: z.string().optional(),
});

// ============================================================
// Response Schema
// ============================================================

/** Single embedding object */
export const embeddingObjectSchema = z.object({
    object: z.literal('embedding'),
    index: z.number().int().nonnegative(),
    embedding: z.union([
        z.array(z.number()), // float format
        z.string(), // base64 format
    ]),
});

/** Embedding usage statistics */
export const embeddingUsageSchema = z.object({
    prompt_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
});

/** Embedding response schema (OpenAI compatible format) */
export const embeddingResponseSchema = z.object({
    object: z.literal('list'),
    data: z.array(embeddingObjectSchema),
    model: z.string(),
    usage: embeddingUsageSchema,
});

// ============================================================
// Log Schema (for Admin API)
// ============================================================

/** Embedding log list item */
export const embeddingLogItemSchema = z.object({
    id: z.string().uuid(),
    apiKeyId: z.string().uuid(),
    provider: z.string(),
    model: z.string(),
    inputCount: z.number().int().positive(),
    dimensions: z.number().int().positive().nullable(),
    requestContent: z.string().nullable(),
    tokens: z.number().int().nonnegative().nullable(),
    latency: z.number().int().nonnegative().nullable(),
    statusCode: z.number().int(),
    createdAt: z.string().datetime(),
});

/** Embedding log query parameters */
export const embeddingLogsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    provider: z.string().optional(),
    model: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    apiKeyId: z.string().uuid().optional(),
});

/** Embedding log list response */
export const embeddingLogListResponseSchema = z.object({
    logs: z.array(embeddingLogItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
});

// ============================================================
// Analytics Schema
// ============================================================

/** Embedding provider statistics */
export const embeddingProviderStatsSchema = z.object({
    provider: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100),
    totalTokens: z.number().int().nonnegative(),
});

/** Embedding model statistics */
export const embeddingModelStatsSchema = z.object({
    model: z.string(),
    provider: z.string(),
    count: z.number().int().nonnegative(),
    avgLatency: z.number().nullable(),
    totalTokens: z.number().int().nonnegative(),
});

/** Embedding analytics response */
export const embeddingAnalyticsResponseSchema = z.object({
    totalRequests: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    avgLatency: z.number().nullable(),
    uniqueProviders: z.number().int().nonnegative(),
    uniqueModels: z.number().int().nonnegative(),
    providerStats: z.array(embeddingProviderStatsSchema),
    modelStats: z.array(embeddingModelStatsSchema),
    tokenUsageOverTime: z.array(z.object({
        date: z.string(),
        tokens: z.number().int().nonnegative(),
        count: z.number().int().nonnegative(),
    })),
    latencyOverTime: z.array(z.object({
        date: z.string(),
        p50: z.number().nullable(),
        p90: z.number().nullable(),
        p99: z.number().nullable(),
        avg: z.number().nullable(),
    })),
});

// ============================================================
// Type Exports
// ============================================================

export type EmbeddingRequest = z.infer<typeof embeddingRequestSchema>;
export type EmbeddingObject = z.infer<typeof embeddingObjectSchema>;
export type EmbeddingUsage = z.infer<typeof embeddingUsageSchema>;
export type EmbeddingResponse = z.infer<typeof embeddingResponseSchema>;
export type EmbeddingLogItem = z.infer<typeof embeddingLogItemSchema>;
export type EmbeddingLogsQuery = z.infer<typeof embeddingLogsQuerySchema>;
export type EmbeddingLogListResponse = z.infer<typeof embeddingLogListResponseSchema>;
export type EmbeddingProviderStats = z.infer<typeof embeddingProviderStatsSchema>;
export type EmbeddingModelStats = z.infer<typeof embeddingModelStatsSchema>;
export type EmbeddingAnalyticsResponse = z.infer<typeof embeddingAnalyticsResponseSchema>;
