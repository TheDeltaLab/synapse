import type { Context } from 'hono';
import { prisma, encryptContent, isEncryptionConfigured } from '@synapse/dal';
import { HTTP_STATUS, type CacheType } from '@synapse/shared';
import { getProviderAdapter } from '../adapters/index.js';
import type { ParsedResponse, ParsedEmbeddingResponse, ChatMessage } from '../adapters/types.js';
import type { ProviderName } from '../config/providers.js';
import { cachedFetch } from '../middleware/cache.js';
import { providerRegistry } from '../services/provider-registry.js';
import { redisService } from '../services/redis-service.js';

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

// Headers stripped from client requests before forwarding upstream.
// accept-encoding is stripped so Node.js fetch handles compression negotiation
// and auto-decompression transparently.
const STRIPPED_REQUEST_HEADERS = new Set([
    'host',
    'authorization',
    'content-length',
    'accept-encoding',
]);

/**
 * Build upstream request headers by merging client headers with endpoint auth headers.
 * Strips hop-by-hop, host, authorization, content-length, and x-synapse-* headers.
 * Endpoint headers (auth) take precedence over client headers.
 */
export function buildUpstreamHeaders(
    incomingHeaders: Headers,
    endpointHeaders: Record<string, string>,
): Record<string, string> {
    // Use a Headers object to ensure case-insensitive deduplication.
    // Plain objects with both 'content-type' and 'Content-Type' cause
    // duplicate headers in Node.js fetch, which some upstreams reject.
    const merged = new Headers();

    incomingHeaders.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(lower)) return;
        if (STRIPPED_REQUEST_HEADERS.has(lower)) return;
        if (lower.startsWith('x-synapse-')) return;
        merged.set(key, value);
    });

    // Endpoint auth headers override client headers
    for (const [key, value] of Object.entries(endpointHeaders)) {
        merged.set(key, value);
    }

    // Convert back to plain object (keys are lowercase from Headers API)
    const result: Record<string, string> = {};
    merged.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

// Headers stripped from upstream responses.
// content-encoding is stripped because Node.js fetch transparently decompresses
// the response body — forwarding it would cause the client to decompress again.
const STRIPPED_RESPONSE_HEADERS = new Set([
    'content-encoding',
    'content-length',
]);

/**
 * Filter upstream response headers, stripping hop-by-hop and encoding headers.
 */
export function filterResponseHeaders(upstreamHeaders: Headers): Headers {
    const filtered = new Headers();

    upstreamHeaders.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP_HEADERS.has(lower)) return;
        if (STRIPPED_RESPONSE_HEADERS.has(lower)) return;
        filtered.set(key, value);
    });

    return filtered;
}

interface ChatLogParams {
    apiKeyId: string;
    provider: string;
    model: string;
    statusCode: number;
    latency: number;
    messages?: ChatMessage[];
    responseBody?: string;
    parsedResponse?: ParsedResponse;
    cached?: boolean;
    cacheType?: CacheType;
    cacheTtl?: number;
}

interface EmbeddingLogParams {
    apiKeyId: string;
    provider: string | null;
    model: string | null;
    inputs: string[] | null;
    responseBody: string | null;
    latency: number | null;
    statusCode: number;
    tokens?: number | null;
}

/**
 * Unified transparent proxy handler.
 * Forwards any request to the resolved upstream provider.
 */
export async function handleProxy(c: Context): Promise<Response> {
    const startTime = Date.now();

    try {
        const apiKey = c.get('apiKey');
        const method = c.req.method;
        const url = new URL(c.req.url);
        const requestPath = url.pathname;
        const queryString = url.search;
        const providerId = c.req.header('x-synapse-provider') as ProviderName | undefined;
        const responseStyle = c.req.header('x-synapse-response-style');

        let rawBody: string | undefined;
        let model: string | undefined;
        let isStreaming = false;

        // Parse body for methods that have one
        // TODO: c.req.text() forces text decoding which corrupts binary/multipart payloads
        // (e.g. file uploads to /v1/files). For true transparent proxying, forward
        // c.req.raw.body stream directly and only clone+parse when Content-Type is JSON.
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            rawBody = await c.req.text();
            try {
                const parsed = JSON.parse(rawBody);
                model = parsed.model;
                isStreaming = parsed.stream ?? false;
            } catch {
                // Not valid JSON — forward as-is, no model extraction
            }
        }

        // Resolve upstream endpoint
        let endpoint;
        try {
            endpoint = providerRegistry.resolveEndpoint(
                requestPath,
                model,
                undefined,
                providerId || undefined,
            );
        } catch (error) {
            return c.json({
                error: 'Bad Request',
                message: error instanceof Error ? error.message : 'Failed to resolve provider',
            }, HTTP_STATUS.BAD_REQUEST);
        }

        const upstreamUrl = endpoint.url + queryString;

        // Build fetch options — forward client headers, overlay auth
        const fetchInit: RequestInit = {
            method,
            headers: buildUpstreamHeaders(c.req.raw.headers, endpoint.headers),
        };
        if (rawBody !== undefined) {
            fetchInit.body = rawBody;
        }

        // Forward to upstream
        let upstreamResponse: Response;
        let cacheHit = false;
        let cacheTtl = 0;

        // Only cache POST requests when Redis is available
        // TODO: This caches all POST requests indiscriminately. Non-idempotent endpoints
        // (e.g. /v1/files, /v1/fine_tuning/jobs) should not be cached. Consider restricting
        // caching to specific safe paths like /v1/chat/completions and /v1/embeddings.
        if (method === 'POST' && redisService.available) {
            const result = await cachedFetch(
                upstreamUrl,
                fetchInit,
                { streaming: isStreaming },
            );
            upstreamResponse = result.response;
            cacheHit = result.cacheHit;
            cacheTtl = result.cacheTtl;
        } else {
            upstreamResponse = await fetch(upstreamUrl, fetchInit);
        }

        // Use adapter to classify request type via payload structure
        const adapter = getProviderAdapter(endpoint.providerId, responseStyle || undefined);
        const parsedReq = rawBody ? adapter.parseRequest(rawBody) : { type: 'unknown' as const };

        if (parsedReq.type === 'chat') {
            return handleChatResponse(c, {
                upstreamResponse,
                isStreaming: parsedReq.stream ?? isStreaming,
                messages: parsedReq.messages,
                model: parsedReq.model ?? model ?? 'unknown',
                endpoint,
                adapter,
                startTime,
                apiKeyId: apiKey.id,
                cacheHit,
                cacheTtl,
            });
        }

        if (parsedReq.type === 'embedding') {
            return handleEmbeddingResponse(c, {
                upstreamResponse,
                inputs: parsedReq.inputs ?? null,
                model: parsedReq.model ?? model ?? null,
                endpoint,
                adapter,
                startTime,
                apiKeyId: apiKey.id,
            });
        }

        // Unknown type: log to RequestLog with null tokens, forward response
        return handleGenericResponse(c, {
            upstreamResponse,
            isStreaming,
            model: model ?? null,
            endpoint,
            startTime,
            apiKeyId: apiKey.id,
            cacheHit,
            cacheTtl,
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return c.json({
            error: 'Bad Gateway',
            message: error instanceof Error ? error.message : 'Failed to reach upstream provider',
        }, HTTP_STATUS.BAD_GATEWAY);
    }
}

// --- Chat path handling ---

interface ChatResponseContext {
    upstreamResponse: Response;
    isStreaming: boolean;
    messages?: ChatMessage[];
    model: string;
    endpoint: { providerId: string };
    adapter: { parseResponse: (body: string) => ParsedResponse; parseStreamingResponse: (payload: string) => ParsedResponse };
    startTime: number;
    apiKeyId: string;
    cacheHit: boolean;
    cacheTtl: number;
}

async function handleChatResponse(
    _c: Context,
    ctx: ChatResponseContext,
): Promise<Response> {
    const { upstreamResponse, isStreaming, messages, model, endpoint, adapter, startTime, apiKeyId, cacheHit, cacheTtl } = ctx;

    if (isStreaming) {
        if (!upstreamResponse.body) {
            logChatRequest({
                apiKeyId,
                provider: endpoint.providerId,
                model,
                statusCode: upstreamResponse.status,
                latency: Date.now() - startTime,
                messages,
                cached: cacheHit,
                cacheType: cacheHit ? 'exact' : 'none',
                cacheTtl: cacheHit ? cacheTtl : undefined,
            });
            const headers = filterResponseHeaders(upstreamResponse.headers);
            headers.set('Cache-Control', 'no-cache');
            headers.set('Connection', 'keep-alive');
            return new Response(null, {
                status: upstreamResponse.status,
                headers,
            });
        }

        const [clientStream, logStream] = upstreamResponse.body.tee();

        drainStream(logStream).then((responsePayload) => {
            const parsed = adapter.parseStreamingResponse(responsePayload);
            logChatRequest({
                apiKeyId,
                provider: endpoint.providerId,
                model,
                statusCode: upstreamResponse.status,
                latency: Date.now() - startTime,
                messages,
                responseBody: responsePayload,
                parsedResponse: parsed,
                cached: cacheHit,
                cacheType: cacheHit ? 'exact' : 'none',
                cacheTtl: cacheHit ? cacheTtl : undefined,
            });
        }).catch((err) => {
            console.error('Stream log collection error:', err);
        });

        const streamHeaders = filterResponseHeaders(upstreamResponse.headers);
        streamHeaders.set('Cache-Control', 'no-cache');
        streamHeaders.set('Connection', 'keep-alive');

        return new Response(clientStream, {
            status: upstreamResponse.status,
            headers: streamHeaders,
        });
    }

    // Non-streaming chat
    const responseBody = await upstreamResponse.text();
    const parsed = adapter.parseResponse(responseBody);

    logChatRequest({
        apiKeyId,
        provider: endpoint.providerId,
        model,
        statusCode: upstreamResponse.status,
        latency: Date.now() - startTime,
        messages,
        responseBody,
        parsedResponse: parsed,
        cached: cacheHit,
        cacheType: cacheHit ? 'exact' : 'none',
    });

    return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: filterResponseHeaders(upstreamResponse.headers),
    });
}

// --- Embedding path handling ---

interface EmbeddingResponseContext {
    upstreamResponse: Response;
    inputs: string[] | null;
    model: string | null;
    endpoint: { providerId: string };
    adapter: { parseEmbeddingResponse: (body: string) => ParsedEmbeddingResponse };
    startTime: number;
    apiKeyId: string;
}

async function handleEmbeddingResponse(
    _c: Context,
    ctx: EmbeddingResponseContext,
): Promise<Response> {
    const { upstreamResponse, inputs, model, endpoint, adapter, startTime, apiKeyId } = ctx;

    const responseBody = await upstreamResponse.text();
    const { tokens } = adapter.parseEmbeddingResponse(responseBody);

    logEmbeddingRequest({
        apiKeyId,
        provider: endpoint.providerId,
        model,
        inputs,
        responseBody,
        latency: Date.now() - startTime,
        statusCode: upstreamResponse.status,
        tokens,
    });

    return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: filterResponseHeaders(upstreamResponse.headers),
    });
}

// --- Generic path handling ---

interface GenericResponseContext {
    upstreamResponse: Response;
    isStreaming: boolean;
    model: string | null;
    endpoint: { providerId: string };
    startTime: number;
    apiKeyId: string;
    cacheHit: boolean;
    cacheTtl: number;
}

async function handleGenericResponse(
    _c: Context,
    ctx: GenericResponseContext,
): Promise<Response> {
    const { upstreamResponse, isStreaming, model, endpoint, startTime, apiKeyId, cacheHit, cacheTtl } = ctx;

    if (isStreaming && upstreamResponse.body) {
        const [clientStream, logStream] = upstreamResponse.body.tee();

        drainStream(logStream).then((responsePayload) => {
            logChatRequest({
                apiKeyId,
                provider: endpoint.providerId,
                model: model ?? 'unknown',
                statusCode: upstreamResponse.status,
                latency: Date.now() - startTime,
                responseBody: responsePayload,
                cached: cacheHit,
                cacheType: cacheHit ? 'exact' : 'none',
                cacheTtl: cacheHit ? cacheTtl : undefined,
            });
        }).catch((err) => {
            console.error('Stream log collection error:', err);
        });

        const genericStreamHeaders = filterResponseHeaders(upstreamResponse.headers);
        genericStreamHeaders.set('Cache-Control', 'no-cache');
        genericStreamHeaders.set('Connection', 'keep-alive');

        return new Response(clientStream, {
            status: upstreamResponse.status,
            headers: genericStreamHeaders,
        });
    }

    // Non-streaming generic
    const responseBody = await upstreamResponse.text();

    logChatRequest({
        apiKeyId,
        provider: endpoint.providerId,
        model: model ?? 'unknown',
        statusCode: upstreamResponse.status,
        latency: Date.now() - startTime,
        responseBody,
        cached: cacheHit,
        cacheType: cacheHit ? 'exact' : 'none',
    });

    return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: filterResponseHeaders(upstreamResponse.headers),
    });
}

// --- Logging helpers ---

async function logChatRequest(params: ChatLogParams): Promise<void> {
    try {
        const responseText = params.parsedResponse?.content ?? params.responseBody ?? undefined;

        const encryptedContent = isEncryptionConfigured()
            ? encryptContent(
                    params.messages ?? undefined,
                    responseText,
                )
            : { promptContent: null, responseContent: null, contentIv: null, contentTag: null };

        const usage = params.parsedResponse?.usage;

        await prisma.requestLog.create({
            data: {
                apiKeyId: params.apiKeyId,
                provider: params.provider,
                model: params.model,
                statusCode: params.statusCode,
                latency: params.latency,
                inputTokens: usage?.inputTokens ?? null,
                outputTokens: usage?.outputTokens ?? null,
                totalTokens: usage ? (usage.inputTokens + usage.outputTokens) : null,
                // @ts-expect-error - Uint8Array/Buffer type mismatch in TS 5.7+ with Node.js
                promptContent: encryptedContent.promptContent,
                // @ts-expect-error - Uint8Array/Buffer type mismatch in TS 5.7+ with Node.js
                responseContent: encryptedContent.responseContent,
                // @ts-expect-error - Uint8Array/Buffer type mismatch in TS 5.7+ with Node.js
                contentIv: encryptedContent.contentIv,
                // @ts-expect-error - Uint8Array/Buffer type mismatch in TS 5.7+ with Node.js
                contentTag: encryptedContent.contentTag,
                cached: params.cached ?? false,
                cacheType: params.cacheType ?? null,
                cacheTtl: params.cacheTtl ?? null,
                costSaving: null,
                latencySaving: null,
            },
        });
    } catch (error) {
        console.error('Failed to log request:', error);
    }
}

async function logEmbeddingRequest(params: EmbeddingLogParams): Promise<void> {
    try {
        await prisma.embeddingLog.create({
            data: {
                apiKeyId: params.apiKeyId,
                provider: params.provider ?? 'unknown',
                model: params.model ?? 'unknown',
                inputCount: params.inputs?.length ?? 0,
                dimensions: null,
                requestContent: params.inputs ? JSON.stringify(params.inputs) : null,
                tokens: params.tokens ?? null,
                latency: params.latency,
                statusCode: params.statusCode,
            },
        });
    } catch (error) {
        console.error('Failed to log embedding request:', error);
    }
}

/**
 * Drain a ReadableStream into a string (for logging raw payload).
 */
async function drainStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
        }
    } finally {
        reader.releaseLock();
    }
    return result;
}
