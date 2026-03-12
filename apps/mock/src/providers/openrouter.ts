import { Hono } from 'hono';
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

// Health check
openrouterApp.get('/health', c => c.json({ status: 'ok', provider: 'openrouter-mock' }));

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

// Chat completions — 501 Not Implemented
openrouterApp.post('/v1/chat/completions', (c) => {
    return c.json(
        {
            error: {
                message: 'Chat completions are not implemented in the mock server.',
                type: 'api_error',
                param: null,
                code: 'not_implemented',
            },
        },
        501,
    );
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
