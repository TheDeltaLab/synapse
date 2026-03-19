import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type {
    LanguageModelV3Middleware,
    LanguageModelV3StreamPart,
} from '@ai-sdk/provider';
import { simulateReadableStream } from 'ai';
import { DEFAULT_CACHE_TTL } from '@synapse/shared';
import { redisService } from '../services/redis-service.js';

const KEY_PREFIX = 'lm_cache:';

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
 * Compute a deterministic cache key from the full call parameters.
 */
function computeCacheKey(prefix: string, params: unknown): string {
    const identifier = JSON.stringify(params);
    const hash = createHash('sha256').update(identifier).digest('hex');
    return `${KEY_PREFIX}${prefix}:${hash}`;
}

/**
 * AI SDK LanguageModelV3Middleware that caches LLM responses in Redis.
 *
 * - wrapGenerate: Caches full generation results (non-streaming)
 * - wrapStream: Caches collected stream chunks and replays them on hit
 *
 * Cache metadata is written to the AsyncLocalStorage context so the chat
 * handler can include it in request logs.
 */
export const lmCacheMiddleware: LanguageModelV3Middleware = {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate, params }) => {
        if (!isCacheEnabled()) {
            return doGenerate();
        }

        const ttl = getCacheTtl();
        const cacheKey = computeCacheKey('generate', params);

        // Write cache key and TTL to context (will be updated with hit status)
        const ctx = cacheStore.getStore();
        if (ctx) {
            ctx.cacheKey = cacheKey;
            ctx.ttl = ttl;
        }

        // Check cache
        try {
            const cached = await redisService.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);

                // Re-hydrate Date objects that were serialized as strings
                if (parsed.response?.timestamp) {
                    parsed.response.timestamp = new Date(parsed.response.timestamp);
                }

                if (ctx) {
                    ctx.hit = true;
                }

                return parsed;
            }
        } catch {
            // Cache read/parse failure — proceed to generate
        }

        // Cache miss — call the model
        const result = await doGenerate();

        if (ctx) {
            ctx.hit = false;
        }

        // Fire-and-forget cache write
        try {
            redisService.set(cacheKey, JSON.stringify(result), ttl);
        } catch {
            // Ignore cache write errors
        }

        return result;
    },

    wrapStream: async ({ doStream, params }) => {
        if (!isCacheEnabled()) {
            return doStream();
        }

        const ttl = getCacheTtl();
        const cacheKey = computeCacheKey('stream', params);

        // Write cache key and TTL to context
        const ctx = cacheStore.getStore();
        if (ctx) {
            ctx.cacheKey = cacheKey;
            ctx.ttl = ttl;
        }

        // Check cache
        try {
            const cached = await redisService.get(cacheKey);
            if (cached) {
                const chunks: LanguageModelV3StreamPart[] = JSON.parse(cached);

                // Re-hydrate Date timestamps
                const formattedChunks = chunks.map((part) => {
                    if (part.type === 'response-metadata' && part.timestamp) {
                        return { ...part, timestamp: new Date(part.timestamp) };
                    }
                    return part;
                });

                if (ctx) {
                    ctx.hit = true;
                }

                return {
                    stream: simulateReadableStream({
                        chunks: formattedChunks,
                        chunkDelayInMs: 0,
                    }),
                };
            }
        } catch {
            // Cache read/parse failure — proceed to stream
        }

        // Cache miss — call the model
        const { stream, ...rest } = await doStream();

        if (ctx) {
            ctx.hit = false;
        }

        // Collect chunks and cache after stream completes
        const collectedChunks: LanguageModelV3StreamPart[] = [];
        let hasError = false;

        const transformStream = new TransformStream<
            LanguageModelV3StreamPart,
            LanguageModelV3StreamPart
        >({
            transform(chunk, controller) {
                collectedChunks.push(chunk);
                if (chunk.type === 'error') {
                    hasError = true;
                }
                controller.enqueue(chunk);
            },
            flush() {
                // Only cache if no errors occurred
                if (!hasError) {
                    try {
                        redisService.set(cacheKey, JSON.stringify(collectedChunks), ttl);
                    } catch {
                        // Ignore cache write errors
                    }
                }
            },
        });

        return {
            stream: stream.pipeThrough(transformStream),
            ...rest,
        };
    },
};
