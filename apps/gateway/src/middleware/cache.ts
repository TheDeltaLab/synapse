import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { DEFAULT_CACHE_TTL } from '@synapse/shared';
import { redisService } from '../services/redis-service.js';

const KEY_PREFIX = 'fetch_cache:';

/**
 * Context stored in AsyncLocalStorage for cache metadata communication
 * between the middleware and the chat handler.
 */
export interface CacheContext {
    hit: boolean;
    cacheKey: string;
    ttl: number;
}

export const cacheStore = new AsyncLocalStorage<CacheContext>();

/**
 * Get the configured cache TTL from environment or default.
 */
function getCacheTtl(): number {
    const envTtl = process.env.CACHE_TTL;
    if (envTtl) {
        const parsed = parseInt(envTtl, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_CACHE_TTL;
}

/**
 * Check whether caching is enabled.
 * Disabled if CACHE_ENABLED=false or Redis is not available.
 */
export function isCacheEnabled(): boolean {
    if (process.env.CACHE_ENABLED === 'false') return false;
    return redisService.available;
}

/**
 * Compute a deterministic cache key from URL and body.
 */
function computeCacheKey(url: string, body: string): string {
    const hash = createHash('sha256').update(url + body).digest('hex');
    return `${KEY_PREFIX}${hash}`;
}

export interface CachedFetchResult {
    response: Response;
    cacheHit: boolean;
    cacheKey: string;
    cacheTtl: number;
}

/**
 * Fetch with Redis caching at the HTTP level.
 *
 * - Non-streaming hit: returns cached body as a new Response
 * - Non-streaming miss: fetches, stores body in Redis, returns Response
 * - Streaming hit: returns cached body replayed as a ReadableStream
 * - Streaming miss: fetches, tee()s the stream to collect + cache, returns client stream
 */
export async function cachedFetch(
    url: string,
    init: RequestInit,
    options: { streaming: boolean },
): Promise<CachedFetchResult> {
    const body = typeof init.body === 'string' ? init.body : '';
    const cacheKey = computeCacheKey(url, body);

    if (!isCacheEnabled()) {
        const response = await fetch(url, init);
        return { response, cacheHit: false, cacheKey, cacheTtl: 0 };
    }

    const ttl = getCacheTtl();

    // Try cache read
    try {
        const cached = await redisService.get(cacheKey);
        if (cached) {
            if (options.streaming) {
                // Replay cached body as a streaming response
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(cached));
                        controller.close();
                    },
                });

                const response = new Response(stream, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });

                return { response, cacheHit: true, cacheKey, cacheTtl: ttl };
            }

            // Non-streaming: return cached body as Response
            const response = new Response(cached, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });

            return { response, cacheHit: true, cacheKey, cacheTtl: ttl };
        }
    } catch {
        // Cache read failure — proceed to fetch
    }

    // Cache miss — fetch from upstream
    const response = await fetch(url, init);

    if (!response.ok) {
        // Don't cache error responses
        return { response, cacheHit: false, cacheKey, cacheTtl: 0 };
    }

    if (options.streaming && response.body) {
        // Tee the stream: one for client, one for caching
        const [clientStream, cacheStream] = response.body.tee();

        // Collect and cache in background
        collectAndCache(cacheStream, cacheKey, ttl);

        const proxyResponse = new Response(clientStream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });

        return { response: proxyResponse, cacheHit: false, cacheKey, cacheTtl: ttl };
    }

    // Non-streaming: read body, cache, and return
    const responseBody = await response.text();

    try {
        redisService.set(cacheKey, responseBody, ttl);
    } catch {
        // Ignore cache write errors
    }

    const proxyResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });

    return { response: proxyResponse, cacheHit: false, cacheKey, cacheTtl: ttl };
}

/**
 * Collect a ReadableStream into a string and store it in Redis.
 */
async function collectAndCache(
    stream: ReadableStream<Uint8Array>,
    cacheKey: string,
    ttl: number,
): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let collected = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            collected += decoder.decode(value, { stream: true });
        }

        // Don't cache if the stream contained an error indication
        if (!collected.includes('"error"')) {
            redisService.set(cacheKey, collected, ttl);
        }
    } catch {
        // Ignore collection/cache errors
    } finally {
        reader.releaseLock();
    }
}
