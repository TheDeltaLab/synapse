import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleProxy, buildUpstreamHeaders, filterResponseHeaders } from '../proxy.js';

// Mock the provider registry
vi.mock('../../services/provider-registry.js', () => ({
    providerRegistry: {
        resolveEndpoint: vi.fn((_path: string, model?: string, _task?: string, providerId?: string) => ({
            url: `https://api.example.com${_path}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-key',
            },
            deployment: model ? { modelId: model, providerId: providerId ?? 'openai' } : null,
            providerId: providerId ?? 'openai',
        })),
    },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Prisma DAL
vi.mock('@synapse/dal', () => ({
    prisma: {
        requestLog: {
            create: vi.fn(async () => ({ id: 'mock-log-id' })),
        },
        embeddingLog: {
            create: vi.fn(async () => ({ id: 'mock-embed-log-id' })),
        },
    },
    encryptContent: vi.fn(() => ({
        promptContent: null,
        responseContent: null,
        contentIv: null,
        contentTag: null,
    })),
    isEncryptionConfigured: vi.fn(() => false),
}));

// Mock adapters
vi.mock('../../adapters/index.js', () => ({
    getProviderAdapter: vi.fn(() => ({
        parseRequest: vi.fn((body: string) => {
            try {
                const data = JSON.parse(body);
                if (Array.isArray(data.messages)) {
                    return {
                        type: 'chat' as const,
                        model: data.model,
                        stream: data.stream ?? false,
                        messages: data.messages.map((m: { role?: string; content?: string }) => ({
                            role: String(m.role ?? ''),
                            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                        })),
                    };
                }
                if (data.input !== undefined) {
                    const inputs = Array.isArray(data.input) ? data.input : [data.input];
                    return {
                        type: 'embedding' as const,
                        model: data.model,
                        inputs: inputs.map((i: unknown) => typeof i === 'string' ? i : JSON.stringify(i)),
                    };
                }
                return { type: 'unknown' as const, model: data.model };
            } catch {
                return { type: 'unknown' as const };
            }
        }),
        parseResponse: vi.fn((body: string) => {
            try {
                const data = JSON.parse(body);
                return {
                    content: data.choices?.[0]?.message?.content ?? null,
                    usage: data.usage ? {
                        inputTokens: data.usage.prompt_tokens ?? 0,
                        outputTokens: data.usage.completion_tokens ?? 0,
                    } : null,
                };
            } catch {
                return { content: null, usage: null };
            }
        }),
        parseStreamingResponse: vi.fn(() => ({
            content: 'streamed content',
            usage: { inputTokens: 10, outputTokens: 20 },
        })),
        parseEmbeddingResponse: vi.fn((body: string) => {
            try {
                const data = JSON.parse(body);
                const usage = data.usage;
                if (!usage) return { tokens: null };
                return { tokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : null };
            } catch {
                return { tokens: null };
            }
        }),
    })),
}));

// Mock cache middleware
vi.mock('../../middleware/cache.js', () => ({
    cachedFetch: vi.fn(),
}));

// Mock redis service
vi.mock('../../services/redis-service.js', () => ({
    redisService: { available: false },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<Record<string, any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await res.json()) as Record<string, any>;
}

describe('handleProxy', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = new Hono();
        // Set up mock apiKey context
        app.use('*', async (c, next) => {
            c.set('apiKey', { id: 'test-api-key-id', name: 'test-key', userId: null, rateLimit: 1000 });
            await next();
        });
        app.all('/*', handleProxy);

        // Default mock fetch behavior
        mockFetch.mockImplementation(async () => {
            return new Response(JSON.stringify({
                id: 'chatcmpl-123',
                choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'x-request-id': 'req-abc123',
                    'x-ratelimit-remaining': '99',
                },
            });
        });
    });

    describe('POST /v1/chat/completions', () => {
        it('routes chat completion with model', async () => {
            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(200);
            const json = await parseJson(res);
            expect(json.choices[0].message.content).toBe('Hello!');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/v1/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        // Headers normalized to lowercase by buildUpstreamHeaders
                        authorization: 'Bearer test-key',
                    }),
                }),
            );
        });

        it('logs structured messages for chat requests', async () => {
            const { prisma } = await import('@synapse/dal');

            await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            // Wait for async logging
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(prisma.requestLog.create).toHaveBeenCalled();
        });

        it('uses x-synapse-provider header for routing', async () => {
            const { providerRegistry } = await import('../../services/provider-registry.js');

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-synapse-provider': 'anthropic',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(200);
            expect(providerRegistry.resolveEndpoint).toHaveBeenCalledWith(
                '/v1/chat/completions',
                'claude-sonnet-4-20250514',
                undefined,
                'anthropic',
            );
        });
    });

    describe('POST /v1/embeddings', () => {
        it('routes embedding request and logs structured inputs', async () => {
            const { prisma } = await import('@synapse/dal');

            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({
                    object: 'list',
                    data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
                    model: 'text-embedding-3-small',
                    usage: { prompt_tokens: 5, total_tokens: 5 },
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            });

            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'Hello, world!',
                }),
            });

            expect(res.status).toBe(200);
            const json = await parseJson(res);
            expect(json.object).toBe('list');
            expect(json.data).toHaveLength(1);

            // Wait for async logging
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(prisma.embeddingLog.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    inputCount: 1,
                    requestContent: JSON.stringify(['Hello, world!']),
                    tokens: 5,
                }),
            }));
        });
    });

    describe('GET /v1/models', () => {
        it('defaults to OpenAI when no provider and no model', async () => {
            const { providerRegistry } = await import('../../services/provider-registry.js');

            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({
                    object: 'list',
                    data: [{ id: 'gpt-4o', object: 'model' }],
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            });

            const res = await app.request('/v1/models', { method: 'GET' });

            expect(res.status).toBe(200);
            // No model in GET body, so resolveEndpoint is called without model
            expect(providerRegistry.resolveEndpoint).toHaveBeenCalledWith(
                '/v1/models',
                undefined,
                undefined,
                undefined,
            );
        });

        it('uses specified provider for GET requests', async () => {
            const { providerRegistry } = await import('../../services/provider-registry.js');

            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({
                    object: 'list',
                    data: [{ id: 'deepseek-chat', object: 'model' }],
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            });

            const res = await app.request('/v1/models', {
                method: 'GET',
                headers: { 'x-synapse-provider': 'deepseek' },
            });

            expect(res.status).toBe(200);
            expect(providerRegistry.resolveEndpoint).toHaveBeenCalledWith(
                '/v1/models',
                undefined,
                undefined,
                'deepseek',
            );
        });
    });

    describe('streaming', () => {
        it('forwards streaming response with tee for logging', async () => {
            const encoder = new TextEncoder();
            const sseData = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n';
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseData));
                    controller.close();
                },
            });

            mockFetch.mockImplementation(async () => {
                return new Response(stream, {
                    status: 200,
                    headers: { 'Content-Type': 'text/event-stream' },
                });
            });

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                    stream: true,
                }),
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/event-stream');

            const body = await res.text();
            expect(body).toContain('data: ');
        });
    });

    describe('error handling', () => {
        it('forwards upstream error responses', async () => {
            mockFetch.mockImplementation(async () => {
                return new Response(
                    JSON.stringify({ error: { message: 'Invalid model', type: 'invalid_request_error' } }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } },
                );
            });

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(400);
            const json = await parseJson(res);
            expect(json.error.message).toBe('Invalid model');
        });

        it('returns 502 on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network failure'));

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(502);
            const json = await parseJson(res);
            expect(json.error).toBe('Bad Gateway');
        });

        it('returns 400 when provider resolution fails', async () => {
            const { providerRegistry } = await import('../../services/provider-registry.js');
            vi.mocked(providerRegistry.resolveEndpoint).mockImplementationOnce(() => {
                throw new Error('Provider openai not found or not configured');
            });

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(400);
            const json = await parseJson(res);
            expect(json.message).toContain('not found or not configured');
        });
    });

    describe('query string forwarding', () => {
        it('forwards query parameters to upstream', async () => {
            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({ object: 'list', data: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            });

            await app.request('/v1/models?limit=10&order=asc', { method: 'GET' });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/v1/models?limit=10&order=asc',
                expect.any(Object),
            );
        });
    });

    describe('generic path', () => {
        it('proxies non-chat, non-embedding paths and logs to RequestLog', async () => {
            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            });

            const res = await app.request('/v1/models', { method: 'GET' });

            expect(res.status).toBe(200);
            const json = await parseJson(res);
            expect(json.ok).toBe(true);
        });
    });

    describe('header forwarding', () => {
        it('forwards upstream response headers to client', async () => {
            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('x-request-id')).toBe('req-abc123');
            expect(res.headers.get('x-ratelimit-remaining')).toBe('99');
        });

        it('forwards client request headers upstream, stripping authorization and x-synapse-*', async () => {
            await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'messages-2024-12-19',
                    'x-synapse-provider': 'anthropic',
                    'x-synapse-response-style': 'openai',
                    'Authorization': 'Bearer user-token',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            const fetchCall = mockFetch.mock.calls[0]!;
            const sentHeaders = fetchCall[1]!.headers as Record<string, string>;

            // Client headers should be forwarded (all lowercase after Headers normalization)
            expect(sentHeaders['accept']).toBeDefined();
            expect(sentHeaders['anthropic-version']).toBeDefined();
            expect(sentHeaders['anthropic-beta']).toBeDefined();

            // Endpoint auth should override client auth (lowercase)
            expect(sentHeaders['authorization']).toBe('Bearer test-key');

            // x-synapse-* headers must NOT be forwarded upstream
            const allKeys = Object.keys(sentHeaders).map(k => k.toLowerCase());
            expect(allKeys.some(k => k.startsWith('x-synapse-'))).toBe(false);
        });

        it('strips hop-by-hop headers from response', async () => {
            mockFetch.mockImplementation(async () => {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Transfer-Encoding': 'chunked',
                        'Connection': 'keep-alive',
                        'x-custom': 'preserved',
                    },
                });
            });

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                }),
            });

            expect(res.headers.get('x-custom')).toBe('preserved');
            // Hop-by-hop headers should be stripped
            expect(res.headers.get('transfer-encoding')).toBeNull();
        });

        it('forwards upstream headers on streaming responses', async () => {
            const encoder = new TextEncoder();
            const sseData = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n';
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(sseData));
                    controller.close();
                },
            });

            mockFetch.mockImplementation(async () => {
                return new Response(stream, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'x-request-id': 'stream-req-456',
                        'openai-model': 'gpt-4o-2024-05-13',
                    },
                });
            });

            const res = await app.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Hi' }],
                    stream: true,
                }),
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('x-request-id')).toBe('stream-req-456');
            expect(res.headers.get('openai-model')).toBe('gpt-4o-2024-05-13');
            expect(res.headers.get('Cache-Control')).toBe('no-cache');
        });
    });

    describe('buildUpstreamHeaders', () => {
        it('merges client headers with endpoint headers, endpoint wins', () => {
            const incoming = new Headers({
                'Accept': 'application/json',
                'Authorization': 'Bearer user-key',
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
            });
            const endpointHeaders = {
                'Authorization': 'Bearer provider-key',
                'Content-Type': 'application/json',
            };

            const result = buildUpstreamHeaders(incoming, endpointHeaders);

            // Headers API normalizes keys to lowercase
            expect(result['accept']).toBe('application/json');
            expect(result['anthropic-version']).toBe('2023-06-01');
            // Endpoint auth overrides (normalized to lowercase by Headers)
            expect(result['authorization']).toBe('Bearer provider-key');
            // No duplicate content-type keys
            expect(Object.keys(result).filter(k => k.toLowerCase() === 'content-type')).toHaveLength(1);
        });

        it('strips x-synapse-*, host, content-length, and hop-by-hop headers', () => {
            const incoming = new Headers({
                'Host': 'gateway.local',
                'Content-Length': '42',
                'x-synapse-provider': 'openai',
                'x-synapse-response-style': 'native',
                'Connection': 'keep-alive',
                'Accept': '*/*',
            });

            const result = buildUpstreamHeaders(incoming, {});

            expect(result['accept']).toBe('*/*');
            // All of these should be stripped
            expect(result['host']).toBeUndefined();
            expect(result['content-length']).toBeUndefined();
            expect(result['x-synapse-provider']).toBeUndefined();
            expect(result['x-synapse-response-style']).toBeUndefined();
            expect(result['connection']).toBeUndefined();
        });
    });

    describe('filterResponseHeaders', () => {
        it('copies all headers except hop-by-hop and encoding headers', () => {
            const upstream = new Headers({
                'Content-Type': 'application/json',
                'x-request-id': 'abc',
                'Transfer-Encoding': 'chunked',
                'Connection': 'keep-alive',
                'Content-Encoding': 'gzip',
                'Content-Length': '1234',
            });

            const filtered = filterResponseHeaders(upstream);

            expect(filtered.get('Content-Type')).toBe('application/json');
            expect(filtered.get('x-request-id')).toBe('abc');
            // Hop-by-hop headers stripped
            expect(filtered.get('Transfer-Encoding')).toBeNull();
            expect(filtered.get('Connection')).toBeNull();
            // Encoding headers stripped (body already decompressed by fetch)
            expect(filtered.get('Content-Encoding')).toBeNull();
            expect(filtered.get('Content-Length')).toBeNull();
        });
    });
});
