import { Hono } from 'hono';

export const anthropicApp = new Hono();

// Health check
anthropicApp.get('/health', c => c.json({ status: 'ok', provider: 'anthropic-mock' }));

// Messages — 501 Not Implemented
anthropicApp.post('/v1/messages', (c) => {
    return c.json(
        {
            type: 'error',
            error: {
                type: 'not_implemented',
                message: 'Chat messages are not implemented in the mock server.',
            },
        },
        501,
    );
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
