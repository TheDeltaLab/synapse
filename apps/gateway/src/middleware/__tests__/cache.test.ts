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

// Mock @synapse/shared
vi.mock('@synapse/shared', () => ({
    DEFAULT_CACHE_TTL: 3600,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { cachedFetch, cacheStore, isCacheEnabled, type CacheContext } from '../../middleware/cache.js';

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

    describe('cachedFetch - non-streaming', () => {
        it('should return cached response on hit with stored status and headers', async () => {
            const cachedBody = JSON.stringify({ choices: [{ message: { content: 'cached' } }] });
            const cacheEntry = JSON.stringify({
                status: 200,
                headers: { 'content-type': 'application/json', 'x-request-id': 'cached-req-1' },
                body: cachedBody,
            });
            mockRedisService.get.mockResolvedValue(cacheEntry);

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.response.status).toBe(200);
            expect(result.response.headers.get('x-request-id')).toBe('cached-req-1');

            const body = await result.response.text();
            expect(body).toBe(cachedBody);
        });

        it('should handle legacy plain-string cache entries', async () => {
            const legacyBody = JSON.stringify({ choices: [{ message: { content: 'legacy' } }] });
            // Simulate a legacy entry that is a JSON body without the CacheEntry wrapper.
            // parseCacheEntry will see it has no .body field and treat as legacy.
            mockRedisService.get.mockResolvedValue(legacyBody);

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(true);
            expect(result.response.status).toBe(200);
            const body = await result.response.text();
            expect(body).toBe(legacyBody);
        });

        it('should store CacheEntry with status and headers on miss', async () => {
            const responseBody = JSON.stringify({ choices: [{ message: { content: 'fresh' } }] });
            mockRedisService.get.mockResolvedValue(null);
            mockFetch.mockResolvedValue(new Response(responseBody, {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'x-request-id': 'fresh-req-1' },
            }));

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(false);
            expect(mockFetch).toHaveBeenCalled();

            // Verify the stored value is a CacheEntry JSON
            const storedValue = mockRedisService.set.mock.calls[0]![1] as string;
            const storedEntry = JSON.parse(storedValue);
            expect(storedEntry.status).toBe(200);
            expect(storedEntry.headers['content-type']).toBe('application/json');
            expect(storedEntry.headers['x-request-id']).toBe('fresh-req-1');
            expect(storedEntry.body).toBe(responseBody);

            const body = await result.response.text();
            expect(body).toBe(responseBody);
        });

        it('should not cache error responses', async () => {
            mockRedisService.get.mockResolvedValue(null);
            mockFetch.mockResolvedValue(new Response('{"error":"bad request"}', {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }));

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(false);
            expect(mockRedisService.set).not.toHaveBeenCalled();
        });

        it('should passthrough when cache is disabled', async () => {
            mockRedisService.available = false;
            const responseBody = '{"result":"ok"}';
            mockFetch.mockResolvedValue(new Response(responseBody, { status: 200 }));

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(false);
            expect(mockRedisService.get).not.toHaveBeenCalled();
        });

        it('should use custom TTL from environment', async () => {
            process.env.CACHE_TTL = '7200';
            mockRedisService.get.mockResolvedValue(null);
            mockFetch.mockResolvedValue(new Response('{"ok":true}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }));

            await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{}' },
                { streaming: false },
            );

            expect(mockRedisService.set).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                7200,
            );

            // Verify it's a CacheEntry
            const storedValue = mockRedisService.set.mock.calls[0]![1] as string;
            const storedEntry = JSON.parse(storedValue);
            expect(storedEntry.body).toBe('{"ok":true}');
        });

        it('should produce deterministic cache keys for same URL and body', async () => {
            const keys: string[] = [];
            mockRedisService.get.mockImplementation(async (key: string) => {
                keys.push(key);
                return null;
            });
            mockFetch.mockImplementation(async () => new Response('{}', { status: 200 }));

            await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test"}' },
                { streaming: false },
            );

            expect(keys[0]).toBe(keys[1]);
        });

        it('should handle cache read errors gracefully', async () => {
            mockRedisService.get.mockRejectedValue(new Error('Redis error'));
            mockFetch.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{}' },
                { streaming: false },
            );

            expect(result.cacheHit).toBe(false);
            expect(mockFetch).toHaveBeenCalled();
        });
    });

    describe('cachedFetch - streaming', () => {
        it('should return cached body as stream on hit with stored headers', async () => {
            const cachedBody = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
            const cacheEntry = JSON.stringify({
                status: 200,
                headers: { 'content-type': 'text/event-stream', 'x-request-id': 'cached-stream-1' },
                body: cachedBody,
            });
            mockRedisService.get.mockResolvedValue(cacheEntry);

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test","stream":true}' },
                { streaming: true },
            );

            expect(result.cacheHit).toBe(true);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.response.status).toBe(200);
            expect(result.response.headers.get('x-request-id')).toBe('cached-stream-1');
            expect(result.response.headers.get('Cache-Control')).toBe('no-cache');

            // Read the stream
            const reader = result.response.body!.getReader();
            const decoder = new TextDecoder();
            let text = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value);
            }
            expect(text).toBe(cachedBody);
        });

        it('should fetch and tee stream on miss, storing CacheEntry', async () => {
            const streamBody = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n';
            const encoder = new TextEncoder();
            const responseStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(streamBody));
                    controller.close();
                },
            });

            mockRedisService.get.mockResolvedValue(null);
            mockFetch.mockResolvedValue(new Response(responseStream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'stream-miss-1' },
            }));

            const result = await cachedFetch(
                'https://api.example.com/v1/chat/completions',
                { method: 'POST', headers: {}, body: '{"model":"test","stream":true}' },
                { streaming: true },
            );

            expect(result.cacheHit).toBe(false);
            expect(mockFetch).toHaveBeenCalled();

            // Consume the client stream
            const reader = result.response.body!.getReader();
            const decoder = new TextDecoder();
            let text = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value);
            }
            expect(text).toBe(streamBody);

            // Wait a tick for background cache write
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(mockRedisService.set).toHaveBeenCalled();

            // Verify the stored value is a CacheEntry
            const storedValue = mockRedisService.set.mock.calls[0]![1] as string;
            const storedEntry = JSON.parse(storedValue);
            expect(storedEntry.status).toBe(200);
            expect(storedEntry.headers['content-type']).toBe('text/event-stream');
            expect(storedEntry.body).toBe(streamBody);
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
