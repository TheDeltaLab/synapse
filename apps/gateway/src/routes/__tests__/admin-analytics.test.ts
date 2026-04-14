import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockRequestLogFindMany,
    mockRequestLogCount,
    mockEmbeddingLogFindMany,
    mockEmbeddingLogCount,
} = vi.hoisted(() => ({
    mockRequestLogFindMany: vi.fn(),
    mockRequestLogCount: vi.fn(),
    mockEmbeddingLogFindMany: vi.fn(),
    mockEmbeddingLogCount: vi.fn(),
}));

vi.mock('@synapse/dal', () => ({
    prisma: {
        apiKey: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        requestLog: {
            findMany: mockRequestLogFindMany,
            count: mockRequestLogCount,
        },
        embeddingLog: {
            findMany: mockEmbeddingLogFindMany,
            count: mockEmbeddingLogCount,
        },
    },
    decryptContent: vi.fn(),
}));

vi.mock('../../config/providers.js', () => ({
    providers: [],
    getChatDeployments: vi.fn(() => []),
    getDefaultChatModel: vi.fn(() => undefined),
    getDefaultEmbeddingModel: vi.fn(() => null),
    getEmbeddingDeployments: vi.fn(() => []),
}));

vi.mock('../../services/provider-registry.js', () => ({
    providerRegistry: {
        getAvailableEmbeddingProviders: vi.fn(() => []),
    },
}));

import { admin } from '../admin.js';

describe('admin analytics routes', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRequestLogFindMany.mockResolvedValue([]);
        mockRequestLogCount.mockResolvedValue(0);
        mockEmbeddingLogFindMany.mockResolvedValue([]);
        mockEmbeddingLogCount.mockResolvedValue(0);

        app = new Hono();
        app.route('/admin', admin);
    });

    it('filters chat analytics to successful requests by default', async () => {
        const res = await app.request('/admin/logs/analytics?range=24h');
        const body = await res.json() as { successRate?: number; totalResponses?: number };

        expect(res.status).toBe(200);
        expect(mockRequestLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                statusCode: 200,
                createdAt: expect.objectContaining({
                    gte: expect.any(Date),
                    lte: expect.any(Date),
                }),
            }),
        }));
        expect(mockRequestLogCount).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                createdAt: expect.objectContaining({
                    gte: expect.any(Date),
                    lte: expect.any(Date),
                }),
            }),
        }));

        const where = mockRequestLogFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
        expect(where).not.toHaveProperty('apiKeyId');
        expect(where).not.toHaveProperty('cached');
        expect(body.successRate).toBe(0);
        expect(body.totalResponses).toBe(0);
    });

    it('applies chat apiKeyId and cacheMissOnly filters', async () => {
        const apiKeyId = '550e8400-e29b-41d4-a716-446655440000';
        mockRequestLogCount.mockResolvedValue(5);
        mockRequestLogFindMany.mockResolvedValue([
            {
                provider: 'openai',
                model: 'gpt-4o',
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15,
                cached: false,
                latency: 120,
                createdAt: new Date('2026-04-14T10:00:00Z'),
            },
            {
                provider: 'openai',
                model: 'gpt-4o',
                inputTokens: 8,
                outputTokens: 4,
                totalTokens: 12,
                cached: false,
                latency: 100,
                createdAt: new Date('2026-04-14T10:01:00Z'),
            },
        ]);

        const res = await app.request(`/admin/logs/analytics?range=24h&apiKeyId=${apiKeyId}&cacheMissOnly=true`);
        const body = await res.json() as { successRate?: number; totalResponses?: number };

        expect(res.status).toBe(200);
        expect(mockRequestLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                statusCode: 200,
                apiKeyId,
                cached: false,
            }),
        }));
        expect(mockRequestLogCount).toHaveBeenCalledWith({
            where: expect.objectContaining({
                apiKeyId,
                cached: false,
                createdAt: expect.objectContaining({
                    gte: expect.any(Date),
                    lte: expect.any(Date),
                }),
            }),
        });
        expect(body.totalResponses).toBe(5);
        expect(body.successRate).toBe(40);
    });

    it('applies embedding apiKeyId filter while keeping statusCode=200', async () => {
        const apiKeyId = '550e8400-e29b-41d4-a716-446655440000';
        mockEmbeddingLogCount.mockResolvedValue(4);
        mockEmbeddingLogFindMany.mockResolvedValue([
            {
                provider: 'openai',
                model: 'text-embedding-3-small',
                tokens: 30,
                latency: 80,
                createdAt: new Date('2026-04-14T10:00:00Z'),
            },
            {
                provider: 'openai',
                model: 'text-embedding-3-small',
                tokens: 20,
                latency: 60,
                createdAt: new Date('2026-04-14T10:01:00Z'),
            },
        ]);

        const res = await app.request(`/admin/logs/embeddings/analytics?range=7d&apiKeyId=${apiKeyId}`);
        const body = await res.json() as { successRate?: number; totalResponses?: number };

        expect(res.status).toBe(200);
        expect(mockEmbeddingLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                statusCode: 200,
                apiKeyId,
                createdAt: expect.objectContaining({
                    gte: expect.any(Date),
                    lte: expect.any(Date),
                }),
            }),
        }));
        expect(mockEmbeddingLogCount).toHaveBeenCalledWith({
            where: expect.objectContaining({
                apiKeyId,
                createdAt: expect.objectContaining({
                    gte: expect.any(Date),
                    lte: expect.any(Date),
                }),
            }),
        });
        expect(body.totalResponses).toBe(4);
        expect(body.successRate).toBe(50);
    });

    it('rejects invalid analytics query parameters', async () => {
        const res = await app.request('/admin/logs/analytics?apiKeyId=not-a-uuid&cacheMissOnly=maybe');
        const body = await res.json() as { error?: string };

        expect(res.status).toBe(400);
        expect(body.error).toBe('Validation Error');
        expect(mockRequestLogFindMany).not.toHaveBeenCalled();
    });
});
