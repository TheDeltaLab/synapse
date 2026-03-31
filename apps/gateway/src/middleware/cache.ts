import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { DEFAULT_CACHE_TTL } from '@synapse/shared';
import { redisService } from '../services/redis-service.js';

const KEY_PREFIX = 'fetch_cache:';

// Headers that MUST NOT be forwarded between hops (RFC 2616 §13.5.1)
const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
]);

/**
 * Structured cache entry that preserves upstream status and headers.
 */
export interface CacheEntry {
    status: number;
    headers: Record<string, string>;
    body: string;
}

/**
 * Convert Headers to a plain object, stripping hop-by-hop headers.
 */
function serializeHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            result[key] = value;
        }
    });
    return result;
}

/**
 * Parse a cached value, supporting both new CacheEntry format and legacy plain strings.
 */
function parseCacheEntry(cached: string): CacheEntry {
    try {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        if (typeof parsed === 'object' && parsed !== null && typeof parsed.body === 'string') {
            return parsed as unknown as CacheEntry;
        }
    } catch {
        // Not JSON — legacy plain string
    }
    return { status: 200, headers: { 'content-type': 'application/json' }, body: cached };
}

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
 * TODO: This ignores forwarded request headers (e.g. anthropic-beta, accept).
 * Two requests with the same body but different headers can produce different
 * upstream responses yet share a cache entry. Consider including a normalized
 * subset of forwarded headers in the hash.
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
            console.log(`[Cache] HIT key=${cacheKey.slice(0, 24)}… url=${url}`);
            const entry = parseCacheEntry(cached);

            if (options.streaming) {
                // Replay cached body as a streaming response
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(entry.body));
                        controller.close();
                    },
                });

                const responseHeaders = new Headers(entry.headers);
                responseHeaders.set('Cache-Control', 'no-cache');
                responseHeaders.set('Connection', 'keep-alive');

                const response = new Response(stream, {
                    status: entry.status,
                    headers: responseHeaders,
                });

                return { response, cacheHit: true, cacheKey, cacheTtl: ttl };
            }

            // Non-streaming: return cached body as Response
            const response = new Response(entry.body, {
                status: entry.status,
                headers: entry.headers,
            });

            return { response, cacheHit: true, cacheKey, cacheTtl: ttl };
        } else {
            console.log(`[Cache] MISS key=${cacheKey.slice(0, 24)}… url=${url}`);
        }
    } catch (err) {
        console.error('[Cache] read error:', err instanceof Error ? err.message : err);
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

        // Collect and cache in background (include status + headers)
        collectAndCache(cacheStream, cacheKey, ttl, response.status, serializeHeaders(response.headers));

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
        const entry: CacheEntry = {
            status: response.status,
            headers: serializeHeaders(response.headers),
            body: responseBody,
        };
        await redisService.set(cacheKey, JSON.stringify(entry), ttl);
    } catch (err) {
        console.error('[Cache] write error:', err instanceof Error ? err.message : err);
    }

    const proxyResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });

    return { response: proxyResponse, cacheHit: false, cacheKey, cacheTtl: ttl };
}

/**
 * Collect a ReadableStream into a string and store it in Redis as a CacheEntry.
 */
async function collectAndCache(
    stream: ReadableStream<Uint8Array>,
    cacheKey: string,
    ttl: number,
    status: number,
    headers: Record<string, string>,
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

        // Stream was already filtered by response.ok check above, safe to cache
        if (collected) {
            const entry: CacheEntry = { status, headers, body: collected };
            await redisService.set(cacheKey, JSON.stringify(entry), ttl);
        }
    } catch (err) {
        console.error('[Cache] streaming write error:', err instanceof Error ? err.message : err);
    } finally {
        reader.releaseLock();
    }
}
