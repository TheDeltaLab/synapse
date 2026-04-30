import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { serve, type ServerType } from '@hono/node-server';
import { generateText, streamText } from 'ai';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import app from '../app.js';

// Must set env vars before any app/provider module evaluation.
// vi.hoisted() runs before all imports regardless of source position.
const { GATEWAY_PORT, MOCK_PORTS } = vi.hoisted(() => {
    const MOCK_PORTS = { openai: 19001, anthropic: 19002, google: 19003, openrouter: 19004 };
    const GATEWAY_PORT = 19000;

    process.env.AUTH_DISABLED = 'true';
    process.env.OPENAI_BASE_URL = `http://localhost:${MOCK_PORTS.openai}`;
    process.env.ANTHROPIC_BASE_URL = `http://localhost:${MOCK_PORTS.anthropic}`;
    process.env.GOOGLE_BASE_URL = `http://localhost:${MOCK_PORTS.google}`;
    process.env.OPENROUTER_BASE_URL = `http://localhost:${MOCK_PORTS.openrouter}`;
    process.env.DEEPSEEK_BASE_URL = `http://localhost:${MOCK_PORTS.openai}`; // OpenAI-compatible

    process.env.OPENAI_API_KEY = 'mock-openai-key';
    process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';
    process.env.GOOGLE_API_KEY = 'mock-google-key';
    process.env.OPENROUTER_API_KEY = 'mock-openrouter-key';
    process.env.DEEPSEEK_API_KEY = 'mock-deepseek-key';

    return { GATEWAY_PORT, MOCK_PORTS };
});

// Mock prisma (avoid DB dependency)
vi.mock('@synapse/dal', () => ({
    prisma: {
        requestLog: { create: vi.fn().mockResolvedValue({}) },
        embeddingLog: { create: vi.fn().mockResolvedValue({}) },
    },
    prismaLog: {
        requestLog: {
            create: vi.fn().mockResolvedValue({}),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        embeddingLog: {
            create: vi.fn().mockResolvedValue({}),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
    },
    encryptContent: vi.fn().mockReturnValue({
        promptContent: null,
        responseContent: null,
        contentIv: null,
        contentTag: null,
    }),
    encryptEmbeddingInputs: vi.fn().mockReturnValue({
        requestContent: null,
        requestContentIv: null,
        requestContentTag: null,
    }),
    isEncryptionConfigured: vi.fn().mockReturnValue(false),
}));

// Mock Redis (no cache)
vi.mock('../services/redis-service.js', () => ({
    redisService: {
        available: false,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
    },
}));

const GATEWAY_URL = `http://localhost:${GATEWAY_PORT}`;
const MOCK_RESPONSE_TEXT = 'this is a mock response from LLM';

// --- Inline mock provider servers ---

function createOpenAICompatibleMock(): Hono {
    const mock = new Hono();

    mock.post('/v1/chat/completions', async (c) => {
        const body = await c.req.json();
        const model: string = body.model ?? 'gpt-4o';
        const stream: boolean = body.stream ?? false;
        const chatId = `chatcmpl-mock-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);

        if (stream) {
            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            (async () => {
                try {
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        id: chatId, object: 'chat.completion.chunk', created, model,
                        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
                    })}\n\n`));
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        id: chatId, object: 'chat.completion.chunk', created, model,
                        choices: [{ index: 0, delta: { content: MOCK_RESPONSE_TEXT }, finish_reason: null }],
                    })}\n\n`));
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        id: chatId, object: 'chat.completion.chunk', created, model,
                        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                        usage: { prompt_tokens: 2, completion_tokens: 8, total_tokens: 10 },
                    })}\n\n`));
                    await writer.write(encoder.encode('data: [DONE]\n\n'));
                } finally {
                    await writer.close();
                }
            })();

            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
            });
        }

        return c.json({
            id: chatId, object: 'chat.completion', created, model,
            choices: [{ index: 0, message: { role: 'assistant', content: MOCK_RESPONSE_TEXT }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 2, completion_tokens: 8, total_tokens: 10 },
        });
    });

    return mock;
}

function createAnthropicMock(): Hono {
    const mock = new Hono();

    mock.post('/v1/messages', async (c) => {
        const body = await c.req.json();
        const model: string = body.model ?? 'claude-sonnet-4-20250514';
        const stream: boolean = body.stream ?? false;
        const msgId = `msg_mock_${Date.now()}`;

        if (stream) {
            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            (async () => {
                try {
                    await writer.write(encoder.encode(`event: message_start\ndata: ${JSON.stringify({
                        type: 'message_start',
                        message: { id: msgId, type: 'message', role: 'assistant', content: [], model, stop_reason: null, usage: { input_tokens: 2, output_tokens: 0 } },
                    })}\n\n`));
                    await writer.write(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify({
                        type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' },
                    })}\n\n`));
                    await writer.write(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
                        type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: MOCK_RESPONSE_TEXT },
                    })}\n\n`));
                    await writer.write(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({
                        type: 'content_block_stop', index: 0,
                    })}\n\n`));
                    await writer.write(encoder.encode(`event: message_delta\ndata: ${JSON.stringify({
                        type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 8 },
                    })}\n\n`));
                    await writer.write(encoder.encode(`event: message_stop\ndata: ${JSON.stringify({
                        type: 'message_stop',
                    })}\n\n`));
                } finally {
                    await writer.close();
                }
            })();

            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
            });
        }

        return c.json({
            id: msgId, type: 'message', role: 'assistant',
            content: [{ type: 'text', text: MOCK_RESPONSE_TEXT }],
            model, stop_reason: 'end_turn', stop_sequence: null,
            usage: { input_tokens: 2, output_tokens: 8 },
        });
    });

    return mock;
}

function createGoogleMock(): Hono {
    const mock = new Hono();

    mock.post('/v1beta/models/*', async (c) => {
        const path = c.req.path;
        const colonIdx = path.lastIndexOf(':');
        const action = colonIdx !== -1 ? path.slice(colonIdx + 1) : '';

        if (action === 'generateContent') {
            return c.json({
                candidates: [{ content: { parts: [{ text: MOCK_RESPONSE_TEXT }], role: 'model' }, finishReason: 'STOP', index: 0 }],
                usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 8, totalTokenCount: 10 },
            });
        }

        if (action === 'streamGenerateContent') {
            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            (async () => {
                try {
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        candidates: [{ content: { parts: [{ text: MOCK_RESPONSE_TEXT }], role: 'model' }, finishReason: 'STOP', index: 0 }],
                        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 8, totalTokenCount: 10 },
                    })}\n\n`));
                } finally {
                    await writer.close();
                }
            })();

            return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
            });
        }

        return c.json({ error: { code: 400, message: `Unknown action: ${action}`, status: 'INVALID_ARGUMENT' } }, 400);
    });

    return mock;
}

// --- Server lifecycle ---

let gatewayServer: ServerType;
let mockServers: ServerType[];

beforeAll(async () => {
    const openaiMock = createOpenAICompatibleMock();
    const anthropicMock = createAnthropicMock();
    const googleMock = createGoogleMock();
    const openrouterMock = createOpenAICompatibleMock();

    const openaiServer = serve({ fetch: openaiMock.fetch, port: MOCK_PORTS.openai });
    const anthropicServer = serve({ fetch: anthropicMock.fetch, port: MOCK_PORTS.anthropic });
    const googleServer = serve({ fetch: googleMock.fetch, port: MOCK_PORTS.google });
    const openrouterServer = serve({ fetch: openrouterMock.fetch, port: MOCK_PORTS.openrouter });
    mockServers = [openaiServer, anthropicServer, googleServer, openrouterServer];

    gatewayServer = serve({ fetch: app.fetch, port: GATEWAY_PORT });

    // Wait for servers to be ready
    await new Promise<void>(resolve => setTimeout(resolve, 500));
});

afterAll(async () => {
    const closeServer = (server: ServerType) =>
        new Promise<void>(resolve => server.close(() => resolve()));

    await Promise.all([
        closeServer(gatewayServer),
        ...mockServers.map(closeServer),
    ]);
});

// Helper to collect full text from a streaming response
async function collectStreamText(result: Awaited<ReturnType<typeof streamText>>): Promise<string> {
    let fullText = '';
    for await (const chunk of result.textStream) {
        fullText += chunk;
    }
    return fullText;
}

describe('Gateway Integration Tests', () => {
    it('health check returns ok', async () => {
        const res = await fetch(`${GATEWAY_URL}/health`);
        const body = await res.json() as { status: string };
        expect(res.status).toBe(200);
        expect(body.status).toBe('ok');
    });

    describe('Anthropic provider', () => {
        const model = 'claude-sonnet-4-6';

        function createModel() {
            const anthropic = createAnthropic({
                baseURL: `${GATEWAY_URL}/v1`,
                apiKey: 'test-key',
                headers: { 'x-synapse-provider': 'anthropic' },
            });
            return anthropic(model);
        }

        it('non-streaming with cache disabled', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('streaming with cache disabled', async () => {
            const result = streamText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            const text = await collectStreamText(result);
            expect(text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('non-streaming without cache header (fallback)', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });
    });

    describe('Google provider', () => {
        const model = 'gemini-2.0-flash-exp';

        function createModel() {
            const google = createGoogleGenerativeAI({
                baseURL: `${GATEWAY_URL}/v1beta`,
                apiKey: 'placeholder',
                headers: {
                    'Authorization': 'Bearer test-key',
                    'x-synapse-provider': 'google',
                },
            });
            return google(model);
        }

        it('non-streaming with cache disabled', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('streaming with cache disabled', async () => {
            const result = streamText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            const text = await collectStreamText(result);
            expect(text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('non-streaming without cache header (fallback)', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });
    });

    describe('OpenRouter provider', () => {
        const model = 'gpt-5-mini';

        function createModel() {
            const openai = createOpenAI({
                baseURL: `${GATEWAY_URL}/v1`,
                apiKey: 'test-key',
                headers: { 'x-synapse-provider': 'openrouter' },
            });
            return openai.chat(model);
        }

        it('non-streaming with cache disabled', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('streaming with cache disabled', async () => {
            const result = streamText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            const text = await collectStreamText(result);
            expect(text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('non-streaming without cache header (fallback)', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });
    });

    describe('DeepSeek provider', () => {
        const model = 'deepseek-chat';

        function createModel() {
            const openai = createOpenAI({
                baseURL: `${GATEWAY_URL}/v1`,
                apiKey: 'test-key',
                headers: { 'x-synapse-provider': 'deepseek' },
            });
            return openai.chat(model);
        }

        it('non-streaming with cache disabled', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('streaming with cache disabled', async () => {
            const result = streamText({
                model: createModel(),
                prompt: 'Hello',
                headers: { 'x-synapse-cache': 'false' },
            });
            const text = await collectStreamText(result);
            expect(text).toContain(MOCK_RESPONSE_TEXT);
        });

        it('non-streaming without cache header (fallback)', async () => {
            const result = await generateText({
                model: createModel(),
                prompt: 'Hello',
            });
            expect(result.text).toContain(MOCK_RESPONSE_TEXT);
        });
    });
});
