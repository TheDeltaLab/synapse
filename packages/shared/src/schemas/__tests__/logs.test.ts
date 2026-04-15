import { describe, expect, it } from 'vitest';
import { analyticsQuerySchema, analyticsResponseSchema } from '../logs.js';

describe('analyticsQuerySchema', () => {
    it('should apply the default range', () => {
        const result = analyticsQuerySchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.range).toBe('24h');
            expect(result.data.apiKeyId).toBeUndefined();
            expect(result.data.cacheMissOnly).toBeUndefined();
        }
    });

    it('should accept a valid apiKeyId', () => {
        const result = analyticsQuerySchema.safeParse({
            apiKeyId: '550e8400-e29b-41d4-a716-446655440000',
        });

        expect(result.success).toBe(true);
    });

    it('should parse cacheMissOnly=true', () => {
        const result = analyticsQuerySchema.safeParse({
            cacheMissOnly: 'true',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.cacheMissOnly).toBe(true);
        }
    });

    it('should parse cacheMissOnly=false', () => {
        const result = analyticsQuerySchema.safeParse({
            cacheMissOnly: 'false',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.cacheMissOnly).toBe(false);
        }
    });

    it('should reject an invalid apiKeyId', () => {
        const result = analyticsQuerySchema.safeParse({
            apiKeyId: 'not-a-uuid',
        });

        expect(result.success).toBe(false);
    });

    it('should reject an invalid cacheMissOnly value', () => {
        const result = analyticsQuerySchema.safeParse({
            cacheMissOnly: 'maybe',
        });

        expect(result.success).toBe(false);
    });
});

describe('analyticsResponseSchema', () => {
    it('should accept a valid analytics response with success rate', () => {
        const result = analyticsResponseSchema.safeParse({
            totalRequests: 80,
            totalResponses: 100,
            successRate: 80,
            cacheHitRate: 25,
            uniqueProviders: 2,
            uniqueModels: 3,
            avgLatency: 125,
            totalTokens: 5000,
            totalInputTokens: 3000,
            totalOutputTokens: 2000,
            providerStats: [
                { provider: 'openai', count: 80, percentage: 100 },
            ],
            modelStats: [
                { model: 'gpt-4o', provider: 'openai', count: 80, avgLatency: 125 },
            ],
            tokenUsageOverTime: [
                { date: '2026-04-14T10:00:00Z', inputTokens: 3000, outputTokens: 2000, totalTokens: 5000 },
            ],
            requestsOverTime: [
                { date: '2026-04-14T10:00:00Z', count: 80 },
            ],
            latencyOverTime: [
                { date: '2026-04-14T10:00:00Z', p50: 100, p90: 150, p99: 250, avg: 125 },
            ],
            modelLatencyStats: [
                { model: 'gpt-4o', provider: 'openai', p50: 100, p90: 150, p99: 250, avg: 125, count: 80 },
            ],
        });

        expect(result.success).toBe(true);
    });

    it('should reject a response missing success fields', () => {
        const result = analyticsResponseSchema.safeParse({
            totalRequests: 80,
            cacheHitRate: 25,
            uniqueProviders: 2,
            uniqueModels: 3,
            avgLatency: 125,
            totalTokens: 5000,
            totalInputTokens: 3000,
            totalOutputTokens: 2000,
            providerStats: [],
            modelStats: [],
            tokenUsageOverTime: [],
            requestsOverTime: [],
            latencyOverTime: [],
            modelLatencyStats: [],
        });

        expect(result.success).toBe(false);
    });
});
