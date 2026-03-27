import { describe, it, expect } from 'vitest';
import {
    embeddingRequestSchema,
    embeddingObjectSchema,
    embeddingUsageSchema,
    embeddingResponseSchema,
    embeddingLogItemSchema,
    embeddingLogsQuerySchema,
    embeddingLogListResponseSchema,
    embeddingProviderStatsSchema,
    embeddingModelStatsSchema,
    embeddingAnalyticsResponseSchema,
} from '../embeddings.js';

describe('embeddingRequestSchema', () => {
    describe('valid requests', () => {
        it('should accept minimal valid request with string input', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello, world!',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.model).toBe('text-embedding-3-small');
                expect(result.data.input).toBe('Hello, world!');
                expect(result.data.encoding_format).toBe('float'); // default
            }
        });

        it('should accept request with array input', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: ['Hello', 'World', 'Test'],
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.input).toEqual(['Hello', 'World', 'Test']);
            }
        });

        it('should accept request with all optional fields', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-large',
                input: 'Test input',
                encoding_format: 'base64',
                dimensions: 1536,
                user: 'user-123',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.encoding_format).toBe('base64');
                expect(result.data.dimensions).toBe(1536);
                expect(result.data.user).toBe('user-123');
            }
        });

        it('should accept float encoding format', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Test',
                encoding_format: 'float',
            });
            expect(result.success).toBe(true);
        });

        it('should accept base64 encoding format', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Test',
                encoding_format: 'base64',
            });
            expect(result.success).toBe(true);
        });

        it('should accept maximum allowed dimensions', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-large',
                input: 'Test',
                dimensions: 3072,
            });
            expect(result.success).toBe(true);
        });

        it('should accept single item array', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: ['Single item'],
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid requests', () => {
        it('should reject empty model', () => {
            const result = embeddingRequestSchema.safeParse({
                model: '',
                input: 'Hello',
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing model', () => {
            const result = embeddingRequestSchema.safeParse({
                input: 'Hello',
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing input', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
            });
            expect(result.success).toBe(false);
        });

        it('should reject empty string input', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: '',
            });
            expect(result.success).toBe(false);
        });

        it('should reject empty array input', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: [],
            });
            expect(result.success).toBe(false);
        });

        it('should reject array with empty strings', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: ['Hello', '', 'World'],
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid encoding format', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello',
                encoding_format: 'invalid',
            });
            expect(result.success).toBe(false);
        });

        it('should reject negative dimensions', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello',
                dimensions: -100,
            });
            expect(result.success).toBe(false);
        });

        it('should reject zero dimensions', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello',
                dimensions: 0,
            });
            expect(result.success).toBe(false);
        });

        it('should reject dimensions exceeding maximum', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello',
                dimensions: 3073,
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer dimensions', () => {
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: 'Hello',
                dimensions: 1536.5,
            });
            expect(result.success).toBe(false);
        });

        it('should reject array exceeding 2048 items', () => {
            const largeArray = Array(2049).fill('text');
            const result = embeddingRequestSchema.safeParse({
                model: 'text-embedding-3-small',
                input: largeArray,
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('embeddingObjectSchema', () => {
    it('should accept valid embedding object with float array', () => {
        const result = embeddingObjectSchema.safeParse({
            object: 'embedding',
            index: 0,
            embedding: [0.1, 0.2, -0.3, 0.4],
        });
        expect(result.success).toBe(true);
    });

    it('should accept valid embedding object with base64 string', () => {
        const result = embeddingObjectSchema.safeParse({
            object: 'embedding',
            index: 1,
            embedding: 'base64encodedstring==',
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid object type', () => {
        const result = embeddingObjectSchema.safeParse({
            object: 'invalid',
            index: 0,
            embedding: [0.1, 0.2],
        });
        expect(result.success).toBe(false);
    });

    it('should reject negative index', () => {
        const result = embeddingObjectSchema.safeParse({
            object: 'embedding',
            index: -1,
            embedding: [0.1, 0.2],
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingUsageSchema', () => {
    it('should accept valid usage', () => {
        const result = embeddingUsageSchema.safeParse({
            prompt_tokens: 10,
            total_tokens: 10,
        });
        expect(result.success).toBe(true);
    });

    it('should accept zero tokens', () => {
        const result = embeddingUsageSchema.safeParse({
            prompt_tokens: 0,
            total_tokens: 0,
        });
        expect(result.success).toBe(true);
    });

    it('should reject negative tokens', () => {
        const result = embeddingUsageSchema.safeParse({
            prompt_tokens: -1,
            total_tokens: 10,
        });
        expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
        const result = embeddingUsageSchema.safeParse({
            prompt_tokens: 10,
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingResponseSchema', () => {
    it('should accept valid response', () => {
        const result = embeddingResponseSchema.safeParse({
            object: 'list',
            data: [
                { object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] },
                { object: 'embedding', index: 1, embedding: [0.4, 0.5, 0.6] },
            ],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 8, total_tokens: 8 },
        });
        expect(result.success).toBe(true);
    });

    it('should accept response with single embedding', () => {
        const result = embeddingResponseSchema.safeParse({
            object: 'list',
            data: [{ object: 'embedding', index: 0, embedding: [0.1] }],
            model: 'text-embedding-ada-002',
            usage: { prompt_tokens: 5, total_tokens: 5 },
        });
        expect(result.success).toBe(true);
    });

    it('should accept response with empty data array', () => {
        const result = embeddingResponseSchema.safeParse({
            object: 'list',
            data: [],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 0, total_tokens: 0 },
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid object type', () => {
        const result = embeddingResponseSchema.safeParse({
            object: 'embedding', // should be 'list'
            data: [],
            model: 'text-embedding-3-small',
            usage: { prompt_tokens: 0, total_tokens: 0 },
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingLogItemSchema', () => {
    const validLogItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        apiKeyId: '123e4567-e89b-12d3-a456-426614174001',
        provider: 'openai',
        model: 'text-embedding-3-small',
        inputCount: 5,
        dimensions: 1536,
        requestContent: '["Hello, world!","Test input"]',
        tokens: 100,
        latency: 150,
        statusCode: 200,
        createdAt: '2024-01-15T10:30:00Z',
    };

    it('should accept valid log item', () => {
        const result = embeddingLogItemSchema.safeParse(validLogItem);
        expect(result.success).toBe(true);
    });

    it('should accept null for optional nullable fields', () => {
        const result = embeddingLogItemSchema.safeParse({
            ...validLogItem,
            dimensions: null,
            requestContent: null,
            tokens: null,
            latency: null,
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for id', () => {
        const result = embeddingLogItemSchema.safeParse({
            ...validLogItem,
            id: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
    });

    it('should accept zero inputCount', () => {
        const result = embeddingLogItemSchema.safeParse({
            ...validLogItem,
            inputCount: 0,
        });
        expect(result.success).toBe(true);
    });

    it('should reject negative latency', () => {
        const result = embeddingLogItemSchema.safeParse({
            ...validLogItem,
            latency: -100,
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid datetime format', () => {
        const result = embeddingLogItemSchema.safeParse({
            ...validLogItem,
            createdAt: 'invalid-date',
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingLogsQuerySchema', () => {
    it('should accept empty query with defaults', () => {
        const result = embeddingLogsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.limit).toBe(20);
        }
    });

    it('should accept valid query parameters', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            page: 2,
            limit: 50,
            provider: 'openai',
            model: 'text-embedding-3-small',
        });
        expect(result.success).toBe(true);
    });

    it('should coerce string numbers', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            page: '3',
            limit: '25',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(3);
            expect(result.data.limit).toBe(25);
        }
    });

    it('should accept date filters', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T23:59:59Z',
        });
        expect(result.success).toBe(true);
    });

    it('should accept apiKeyId filter', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            apiKeyId: '123e4567-e89b-12d3-a456-426614174000',
        });
        expect(result.success).toBe(true);
    });

    it('should reject page less than 1', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            page: 0,
        });
        expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            limit: 101,
        });
        expect(result.success).toBe(false);
    });

    it('should reject limit less than 1', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            limit: 0,
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid apiKeyId format', () => {
        const result = embeddingLogsQuerySchema.safeParse({
            apiKeyId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingLogListResponseSchema', () => {
    it('should accept valid response', () => {
        const result = embeddingLogListResponseSchema.safeParse({
            logs: [
                {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    apiKeyId: '123e4567-e89b-12d3-a456-426614174001',
                    provider: 'openai',
                    model: 'text-embedding-3-small',
                    inputCount: 1,
                    dimensions: null,
                    requestContent: '["Hello"]',
                    tokens: 10,
                    latency: 100,
                    statusCode: 200,
                    createdAt: '2024-01-15T10:30:00Z',
                },
            ],
            total: 100,
            page: 1,
            limit: 20,
            totalPages: 5,
        });
        expect(result.success).toBe(true);
    });

    it('should accept empty logs array', () => {
        const result = embeddingLogListResponseSchema.safeParse({
            logs: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
        });
        expect(result.success).toBe(true);
    });
});

describe('embeddingProviderStatsSchema', () => {
    it('should accept valid provider stats', () => {
        const result = embeddingProviderStatsSchema.safeParse({
            provider: 'openai',
            count: 1000,
            percentage: 75.5,
            totalTokens: 50000,
        });
        expect(result.success).toBe(true);
    });

    it('should accept zero values', () => {
        const result = embeddingProviderStatsSchema.safeParse({
            provider: 'google',
            count: 0,
            percentage: 0,
            totalTokens: 0,
        });
        expect(result.success).toBe(true);
    });

    it('should accept 100% percentage', () => {
        const result = embeddingProviderStatsSchema.safeParse({
            provider: 'openai',
            count: 100,
            percentage: 100,
            totalTokens: 1000,
        });
        expect(result.success).toBe(true);
    });

    it('should reject percentage over 100', () => {
        const result = embeddingProviderStatsSchema.safeParse({
            provider: 'openai',
            count: 100,
            percentage: 101,
            totalTokens: 1000,
        });
        expect(result.success).toBe(false);
    });

    it('should reject negative percentage', () => {
        const result = embeddingProviderStatsSchema.safeParse({
            provider: 'openai',
            count: 100,
            percentage: -5,
            totalTokens: 1000,
        });
        expect(result.success).toBe(false);
    });
});

describe('embeddingModelStatsSchema', () => {
    it('should accept valid model stats', () => {
        const result = embeddingModelStatsSchema.safeParse({
            model: 'text-embedding-3-small',
            provider: 'openai',
            count: 500,
            avgLatency: 125.5,
            totalTokens: 25000,
        });
        expect(result.success).toBe(true);
    });

    it('should accept null avgLatency', () => {
        const result = embeddingModelStatsSchema.safeParse({
            model: 'text-embedding-3-small',
            provider: 'openai',
            count: 0,
            avgLatency: null,
            totalTokens: 0,
        });
        expect(result.success).toBe(true);
    });
});

describe('embeddingAnalyticsResponseSchema', () => {
    const validAnalytics = {
        totalRequests: 10000,
        totalTokens: 500000,
        avgLatency: 150.5,
        uniqueProviders: 2,
        uniqueModels: 3,
        providerStats: [
            { provider: 'openai', count: 8000, percentage: 80, totalTokens: 400000 },
            { provider: 'google', count: 2000, percentage: 20, totalTokens: 100000 },
        ],
        modelStats: [
            { model: 'text-embedding-3-small', provider: 'openai', count: 5000, avgLatency: 100, totalTokens: 250000 },
            { model: 'text-embedding-3-large', provider: 'openai', count: 3000, avgLatency: 200, totalTokens: 150000 },
            { model: 'text-embedding-004', provider: 'google', count: 2000, avgLatency: 120, totalTokens: 100000 },
        ],
        tokenUsageOverTime: [
            { date: '2024-01-15T00:00:00Z', tokens: 10000, count: 200 },
            { date: '2024-01-15T01:00:00Z', tokens: 12000, count: 250 },
        ],
        latencyOverTime: [
            { date: '2024-01-15T00:00:00Z', p50: 100, p90: 200, p99: 500, avg: 150 },
            { date: '2024-01-15T01:00:00Z', p50: 110, p90: 210, p99: 520, avg: 160 },
        ],
    };

    it('should accept valid analytics response', () => {
        const result = embeddingAnalyticsResponseSchema.safeParse(validAnalytics);
        expect(result.success).toBe(true);
    });

    it('should accept null avgLatency', () => {
        const result = embeddingAnalyticsResponseSchema.safeParse({
            ...validAnalytics,
            avgLatency: null,
        });
        expect(result.success).toBe(true);
    });

    it('should accept empty arrays', () => {
        const result = embeddingAnalyticsResponseSchema.safeParse({
            totalRequests: 0,
            totalTokens: 0,
            avgLatency: null,
            uniqueProviders: 0,
            uniqueModels: 0,
            providerStats: [],
            modelStats: [],
            tokenUsageOverTime: [],
            latencyOverTime: [],
        });
        expect(result.success).toBe(true);
    });

    it('should accept null latency percentiles', () => {
        const result = embeddingAnalyticsResponseSchema.safeParse({
            ...validAnalytics,
            latencyOverTime: [
                { date: '2024-01-15T00:00:00Z', p50: null, p90: null, p99: null, avg: null },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
        const { totalRequests: _totalRequests, ...incomplete } = validAnalytics;
        const result = embeddingAnalyticsResponseSchema.safeParse(incomplete);
        expect(result.success).toBe(false);
    });

    it('should reject negative totalRequests', () => {
        const result = embeddingAnalyticsResponseSchema.safeParse({
            ...validAnalytics,
            totalRequests: -1,
        });
        expect(result.success).toBe(false);
    });
});
