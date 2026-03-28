import { Hono } from 'hono';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';
import { generateRandomVector, getDimension } from '../utils/vectors.js';

const MOCK_MODELS = [
    'gpt-5-mini',
    'gpt-5',
    'claude-3-5-sonnet',
    'gemini-2.0-flash',
    'text-embedding-3-small',
    'text-embedding-3-large',
];

export const openrouterApp = new Hono();

// Health check (no auth required)
openrouterApp.get('/health', c => c.json({ status: 'ok', provider: 'openrouter-mock' }));

// Auth middleware: require non-empty Bearer token
openrouterApp.use('/*', async (c, next) => {
    const auth = c.req.header('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
        return c.json(
            {
                error: {
                    message: 'You didn\'t provide an API key.',
                    type: 'invalid_request_error',
                    param: null,
                    code: 'invalid_api_key',
                },
            },
            401,
        );
    }
    await next();
});

// List models
openrouterApp.get('/v1/models', (c) => {
    const models = MOCK_MODELS.map(id => ({
        id,
        object: 'model' as const,
        created: 1700000000,
        owned_by: 'openrouter-mock',
    }));
    return c.json({ object: 'list', data: models });
});

// Chat completions
openrouterApp.post('/v1/chat/completions', async (c) => {
    const body = await c.req.json();
    const model: string = body.model ?? 'gpt-5-mini';
    const stream: boolean = body.stream ?? false;

    const chatId = `chatcmpl-mock-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    // Approximate token count (1 token ~ 4 chars)
    const messages: Array<{ content?: string }> = body.messages ?? [];
    const promptTokens = messages.reduce(
        (sum: number, msg: { content?: string }) => sum + Math.ceil(String(msg.content ?? '').length / 4),
        0,
    );
    const completionTokens = Math.ceil(MOCK_RESPONSE_TEXT.length / 4);

    if (stream) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
            try {
                // Send role chunk
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                    id: chatId,
                    object: 'chat.completion.chunk',
                    created,
                    model,
                    choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
                })}\n\n`));

                // Send content chunk
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                    id: chatId,
                    object: 'chat.completion.chunk',
                    created,
                    model,
                    choices: [{ index: 0, delta: { content: MOCK_RESPONSE_TEXT }, finish_reason: null }],
                })}\n\n`));

                // Send final chunk with finish_reason
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                    id: chatId,
                    object: 'chat.completion.chunk',
                    created,
                    model,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    usage: {
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: promptTokens + completionTokens,
                    },
                })}\n\n`));

                await writer.write(encoder.encode('data: [DONE]\n\n'));
            } finally {
                await writer.close();
            }
        })();

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    return c.json({
        id: chatId,
        object: 'chat.completion',
        created,
        model,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: MOCK_RESPONSE_TEXT,
                },
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
        },
    });
});

// Embeddings
openrouterApp.post('/v1/embeddings', async (c) => {
    const body = await c.req.json();
    const model: string = body.model ?? 'text-embedding-3-small';
    const input: string | string[] = body.input;
    const dimensions: number | undefined = body.dimensions;

    const inputs = Array.isArray(input) ? input : [input];
    const dim = getDimension(model, dimensions);

    const data = inputs.map((_text: string, index: number) => ({
        object: 'embedding' as const,
        index,
        embedding: generateRandomVector(dim),
    }));

    // Approximate token count (1 token ~ 4 chars)
    const totalTokens = inputs.reduce((sum, text) => sum + Math.ceil(String(text).length / 4), 0);

    return c.json({
        object: 'list',
        data,
        model,
        usage: {
            prompt_tokens: totalTokens,
            total_tokens: totalTokens,
        },
    });
});

// Not found — OpenAI error shape
openrouterApp.notFound((c) => {
    return c.json(
        {
            error: {
                message: `Unknown endpoint: ${c.req.method} ${c.req.path}`,
                type: 'invalid_request_error',
                param: null,
                code: 'unknown_url',
            },
        },
        404,
    );
});
