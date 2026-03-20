import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted() so mock objects are available in vi.mock() factories
const { mockRedisService } = vi.hoisted(() => ({
    mockRedisService: {
        available: false,
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../services/redis-service.js', () => ({
    redisService: mockRedisService,
}));

// Mock simulateReadableStream from ai
vi.mock('ai', () => ({
    simulateReadableStream: vi.fn(({ chunks }: { chunks: unknown[] }) => {
        return new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(chunk);
                }
                controller.close();
            },
        });
    }),
}));

// Mock @synapse/shared
vi.mock('@synapse/shared', () => ({
    DEFAULT_CACHE_TTL: 3600,
}));

import { lmCacheMiddleware, cacheStore, isCacheEnabled, type CacheContext } from '../../middleware/cache.js';

describe('Cache Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRedisService.available = true;
        mockRedisService.get.mockResolvedValue(null);
        mockRedisService.set.mockResolvedValue(undefined);
        delete process.env.CACHE_ENABLED;
        delete process.env.CACHE_TTL;
    });

    afterEach(() => {
        delete process.env.CACHE_ENABLED;
        delete process.env.CACHE_TTL;
    });

    describe('isCacheEnabled', () => {
        it('should return true when Redis is available and CACHE_ENABLED is not false', () => {
            mockRedisService.available = true;
            expect(isCacheEnabled()).toBe(true);
        });

        it('should return false when Redis is not available', () => {
            mockRedisService.available = false;
            expect(isCacheEnabled()).toBe(false);
        });

        it('should return false when CACHE_ENABLED is false', () => {
            mockRedisService.available = true;
            process.env.CACHE_ENABLED = 'false';
            expect(isCacheEnabled()).toBe(false);
        });

        it('should return true when CACHE_ENABLED is true', () => {
            mockRedisService.available = true;
            process.env.CACHE_ENABLED = 'true';
            expect(isCacheEnabled()).toBe(true);
        });
    });

    describe('wrapGenerate', () => {
        const mockParams = {
            prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        };

        const mockGenerateResult = {
            text: 'Hello there!',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            finishReason: 'stop',
            response: {
                timestamp: new Date('2025-01-01T00:00:00Z'),
            },
        };

        const doGenerate = vi.fn().mockResolvedValue(mockGenerateResult);
        const doStream = vi.fn();
        const mockModel = {} as any;

        beforeEach(() => {
            doGenerate.mockClear().mockResolvedValue(mockGenerateResult);
        });

        it('should passthrough when cache is disabled', async () => {
            mockRedisService.available = false;

            const result = await lmCacheMiddleware.wrapGenerate!({
                doGenerate,
                doStream,
                params: mockParams as any,
                model: mockModel,
            });

            expect(result).toEqual(mockGenerateResult);
            expect(mockRedisService.get).not.toHaveBeenCalled();
        });

        it('should return cached result on hit', async () => {
            const cachedResult = {
                ...mockGenerateResult,
                response: {
                    timestamp: '2025-01-01T00:00:00.000Z',
                },
            };
            mockRedisService.get.mockResolvedValue(JSON.stringify(cachedResult));

            const ctx: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            const result = await cacheStore.run(ctx, () =>
                lmCacheMiddleware.wrapGenerate!({
                    doGenerate,
                    doStream,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(doGenerate).not.toHaveBeenCalled();
            expect(result.response?.timestamp).toBeInstanceOf(Date);
            expect(ctx.hit).toBe(true);
        });

        it('should call doGenerate and cache on miss', async () => {
            mockRedisService.get.mockResolvedValue(null);

            const ctx: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            const result = await cacheStore.run(ctx, () =>
                lmCacheMiddleware.wrapGenerate!({
                    doGenerate,
                    doStream,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(result).toEqual(mockGenerateResult);
            expect(doGenerate).toHaveBeenCalled();
            expect(mockRedisService.set).toHaveBeenCalled();
            expect(ctx.hit).toBe(false);
        });

        it('should use custom TTL from environment', async () => {
            process.env.CACHE_TTL = '7200';
            mockRedisService.get.mockResolvedValue(null);

            const ctx: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            await cacheStore.run(ctx, () =>
                lmCacheMiddleware.wrapGenerate!({
                    doGenerate,
                    doStream,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(ctx.ttl).toBe(7200);
            expect(mockRedisService.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                7200,
            );
        });

        it('should produce deterministic cache keys for same params', async () => {
            const keys: string[] = [];
            mockRedisService.get.mockImplementation(async (key: string) => {
                keys.push(key);
                return null;
            });

            const ctx1: CacheContext = { hit: false, cacheKey: '', ttl: 0 };
            const ctx2: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            await cacheStore.run(ctx1, () =>
                lmCacheMiddleware.wrapGenerate!({
                    doGenerate,
                    doStream,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            await cacheStore.run(ctx2, () =>
                lmCacheMiddleware.wrapGenerate!({
                    doGenerate,
                    doStream,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(keys[0]).toBe(keys[1]);
            expect(ctx1.cacheKey).toBe(ctx2.cacheKey);
        });

        it('should handle cache read errors gracefully', async () => {
            mockRedisService.get.mockRejectedValue(new Error('Redis error'));

            const result = await lmCacheMiddleware.wrapGenerate!({
                doGenerate,
                doStream,
                params: mockParams as any,
                model: mockModel,
            });

            expect(result).toEqual(mockGenerateResult);
            expect(doGenerate).toHaveBeenCalled();
        });
    });

    describe('wrapStream', () => {
        const mockParams = {
            prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        };

        const mockModel = {} as any;

        // Use `any[]` for mock chunks to avoid complex V3 type requirements in tests
        const createMockStream = (chunks: any[]): ReadableStream => {
            return new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(chunk);
                    }
                    controller.close();
                },
            });
        };

        const mockStreamChunks = [
            { type: 'response-metadata', timestamp: new Date('2025-01-01T00:00:00Z'), modelId: 'test' },
            { type: 'text-start', id: 'chunk-1' },
            { type: 'text-delta', id: 'chunk-1', delta: 'Hello ' },
            { type: 'text-delta', id: 'chunk-1', delta: 'world!' },
            { type: 'text-end', id: 'chunk-1' },
            {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                    inputTokens: { total: 5, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: 10, text: undefined, reasoning: undefined },
                },
            },
        ];

        it('should passthrough when cache is disabled', async () => {
            mockRedisService.available = false;
            const doStream = vi.fn().mockResolvedValue({
                stream: createMockStream(mockStreamChunks),
            });
            const doGenerate = vi.fn();

            const result = await lmCacheMiddleware.wrapStream!({
                doStream,
                doGenerate,
                params: mockParams as any,
                model: mockModel,
            });

            expect(mockRedisService.get).not.toHaveBeenCalled();

            // Read the stream to verify it works
            const reader = result.stream.getReader();
            const readChunks: any[] = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                readChunks.push(value);
            }
            expect(readChunks.length).toBe(mockStreamChunks.length);
        });

        it('should return simulated stream on cache hit', async () => {
            const cachedChunks = mockStreamChunks.map((c) => {
                if (c.type === 'response-metadata' && c.timestamp) {
                    return { ...c, timestamp: '2025-01-01T00:00:00.000Z' };
                }
                return c;
            });
            mockRedisService.get.mockResolvedValue(JSON.stringify(cachedChunks));

            const doStream = vi.fn();
            const doGenerate = vi.fn();
            const ctx: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            const result = await cacheStore.run(ctx, () =>
                lmCacheMiddleware.wrapStream!({
                    doStream,
                    doGenerate,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(doStream).not.toHaveBeenCalled();
            expect(ctx.hit).toBe(true);
            expect(result.stream).toBeDefined();
        });

        it('should cache stream chunks on miss', async () => {
            mockRedisService.get.mockResolvedValue(null);
            const doStream = vi.fn().mockResolvedValue({
                stream: createMockStream(mockStreamChunks),
            });
            const doGenerate = vi.fn();

            const ctx: CacheContext = { hit: false, cacheKey: '', ttl: 0 };

            const result = await cacheStore.run(ctx, () =>
                lmCacheMiddleware.wrapStream!({
                    doStream,
                    doGenerate,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            expect(doStream).toHaveBeenCalled();
            expect(ctx.hit).toBe(false);

            // Consume the stream to trigger flush
            const reader = result.stream.getReader();
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }

            // After consuming, the cache should have been set
            expect(mockRedisService.set).toHaveBeenCalledWith(
                expect.stringContaining('lm_cache:stream:'),
                expect.any(String),
                3600,
            );
        });

        it('should not cache stream chunks when error chunk is present', async () => {
            mockRedisService.get.mockResolvedValue(null);
            const errorChunks = [
                { type: 'text-start', id: 'chunk-1' },
                { type: 'error', error: 'something went wrong' },
            ];

            const doStream = vi.fn().mockResolvedValue({
                stream: createMockStream(errorChunks),
            });
            const doGenerate = vi.fn();

            const result = await cacheStore.run(
                { hit: false, cacheKey: '', ttl: 0 },
                () => lmCacheMiddleware.wrapStream!({
                    doStream,
                    doGenerate,
                    params: mockParams as any,
                    model: mockModel,
                }),
            );

            // Consume the stream
            const reader = result.stream.getReader();
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }

            // Should not cache because of error
            expect(mockRedisService.set).not.toHaveBeenCalled();
        });

        it('should handle cache read errors gracefully during stream', async () => {
            mockRedisService.get.mockRejectedValue(new Error('Redis error'));
            const doStream = vi.fn().mockResolvedValue({
                stream: createMockStream(mockStreamChunks),
            });
            const doGenerate = vi.fn();

            const result = await lmCacheMiddleware.wrapStream!({
                doStream,
                doGenerate,
                params: mockParams as any,
                model: mockModel,
            });

            expect(doStream).toHaveBeenCalled();
            expect(result.stream).toBeDefined();
        });
    });

    describe('cacheStore', () => {
        it('should allow reading context within run scope', async () => {
            const ctx: CacheContext = { hit: false, cacheKey: 'test', ttl: 3600 };

            await cacheStore.run(ctx, async () => {
                const store = cacheStore.getStore();
                expect(store).toBe(ctx);
                expect(store?.cacheKey).toBe('test');
            });
        });

        it('should return undefined outside run scope', () => {
            const store = cacheStore.getStore();
            expect(store).toBeUndefined();
        });
    });
});
