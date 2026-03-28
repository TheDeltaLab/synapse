import { Hono } from 'hono';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

export const anthropicApp = new Hono();

// Health check (no auth required)
anthropicApp.get('/health', c => c.json({ status: 'ok', provider: 'anthropic-mock' }));

// Auth middleware: require non-empty x-api-key header
anthropicApp.use('/*', async (c, next) => {
    const apiKey = (c.req.header('x-api-key') ?? '').trim();
    if (!apiKey) {
        return c.json(
            {
                type: 'error',
                error: {
                    type: 'authentication_error',
                    message: 'x-api-key header is required.',
                },
            },
            401,
        );
    }
    await next();
});

// Messages
anthropicApp.post('/v1/messages', async (c) => {
    const body = await c.req.json();
    const model: string = body.model ?? 'claude-sonnet-4-20250514';
    const stream: boolean = body.stream ?? false;

    const msgId = `msg_mock_${Date.now()}`;

    // Approximate token count (1 token ~ 4 chars)
    const messages: Array<{ content?: string }> = body.messages ?? [];
    const inputTokens = messages.reduce(
        (sum: number, msg: { content?: string }) => sum + Math.ceil(String(msg.content ?? '').length / 4),
        0,
    );
    const outputTokens = Math.ceil(MOCK_RESPONSE_TEXT.length / 4);

    if (stream) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        (async () => {
            try {
                // message_start event
                await writer.write(encoder.encode(`event: message_start\ndata: ${JSON.stringify({
                    type: 'message_start',
                    message: {
                        id: msgId,
                        type: 'message',
                        role: 'assistant',
                        content: [],
                        model,
                        stop_reason: null,
                        usage: { input_tokens: inputTokens, output_tokens: 0 },
                    },
                })}\n\n`));

                // content_block_start event
                await writer.write(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify({
                    type: 'content_block_start',
                    index: 0,
                    content_block: { type: 'text', text: '' },
                })}\n\n`));

                // content_block_delta event
                await writer.write(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'text_delta', text: MOCK_RESPONSE_TEXT },
                })}\n\n`));

                // content_block_stop event
                await writer.write(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify({
                    type: 'content_block_stop',
                    index: 0,
                })}\n\n`));

                // message_delta event
                await writer.write(encoder.encode(`event: message_delta\ndata: ${JSON.stringify({
                    type: 'message_delta',
                    delta: { stop_reason: 'end_turn' },
                    usage: { output_tokens: outputTokens },
                })}\n\n`));

                // message_stop event
                await writer.write(encoder.encode(`event: message_stop\ndata: ${JSON.stringify({
                    type: 'message_stop',
                })}\n\n`));
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
        id: msgId,
        type: 'message',
        role: 'assistant',
        content: [
            {
                type: 'text',
                text: MOCK_RESPONSE_TEXT,
            },
        ],
        model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
        },
    });
});

// Not found — Anthropic error shape
anthropicApp.notFound((c) => {
    return c.json(
        {
            type: 'error',
            error: {
                type: 'not_found_error',
                message: `Unknown endpoint: ${c.req.method} ${c.req.path}`,
            },
        },
        404,
    );
});
