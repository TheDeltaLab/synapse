import { Hono } from 'hono';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';
import { generateRandomVector, getDimension } from '../utils/vectors.js';

export const googleApp = new Hono();

// Health check (no auth required)
googleApp.get('/health', c => c.json({ status: 'ok', provider: 'google-mock' }));

// Auth middleware: require non-empty key query param or Bearer token
googleApp.use('/*', async (c, next) => {
    const queryKey = (c.req.query('key') ?? '').trim();
    const auth = c.req.header('Authorization') ?? '';
    const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!queryKey && !bearerToken) {
        return c.json(
            {
                error: {
                    code: 401,
                    message: 'API key not valid. Please pass a valid API key.',
                    status: 'UNAUTHENTICATED',
                },
            },
            401,
        );
    }
    await next();
});

/**
 * Parse `{model}:{action}` from the wildcard path segment.
 * Google API format: /v1beta/models/{model}:{action}
 */
function parseModelAction(path: string): { model: string; action: string } | null {
    // Path looks like /v1beta/models/text-embedding-004:embedContent
    const prefix = '/v1beta/models/';
    if (!path.startsWith(prefix)) return null;

    const remainder = path.slice(prefix.length);
    const colonIdx = remainder.lastIndexOf(':');
    if (colonIdx === -1) return null;

    return {
        model: remainder.slice(0, colonIdx),
        action: remainder.slice(colonIdx + 1),
    };
}

// Wildcard route for /v1beta/models/*
googleApp.post('/v1beta/models/*', async (c) => {
    const parsed = parseModelAction(c.req.path);
    if (!parsed) {
        return c.json(
            {
                error: {
                    code: 400,
                    message: `Invalid path format. Expected /v1beta/models/{model}:{action}`,
                    status: 'INVALID_ARGUMENT',
                },
            },
            400,
        );
    }

    const { model, action } = parsed;

    switch (action) {
        case 'generateContent': {
            // Approximate token count (1 token ~ 4 chars)
            const body = await c.req.json();
            const contents: Array<{ parts?: Array<{ text?: string }> }> = body.contents ?? [];
            const promptTokenCount = contents.reduce(
                (sum: number, content: { parts?: Array<{ text?: string }> }) =>
                    (content.parts ?? []).reduce(
                        (s: number, part: { text?: string }) => s + Math.ceil(String(part.text ?? '').length / 4),
                        sum,
                    ),
                0,
            );
            const candidateTokenCount = Math.ceil(MOCK_RESPONSE_TEXT.length / 4);

            return c.json({
                candidates: [
                    {
                        content: {
                            parts: [{ text: MOCK_RESPONSE_TEXT }],
                            role: 'model',
                        },
                        finishReason: 'STOP',
                        index: 0,
                    },
                ],
                usageMetadata: {
                    promptTokenCount,
                    candidatesTokenCount: candidateTokenCount,
                    totalTokenCount: promptTokenCount + candidateTokenCount,
                },
                modelVersion: model,
            });
        }

        case 'streamGenerateContent': {
            const body = await c.req.json();
            const contents: Array<{ parts?: Array<{ text?: string }> }> = body.contents ?? [];
            const promptTokenCount = contents.reduce(
                (sum: number, content: { parts?: Array<{ text?: string }> }) =>
                    (content.parts ?? []).reduce(
                        (s: number, part: { text?: string }) => s + Math.ceil(String(part.text ?? '').length / 4),
                        sum,
                    ),
                0,
            );
            const candidateTokenCount = Math.ceil(MOCK_RESPONSE_TEXT.length / 4);

            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            (async () => {
                try {
                    // Single chunk with full response
                    await writer.write(encoder.encode(`data: ${JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [{ text: MOCK_RESPONSE_TEXT }],
                                    role: 'model',
                                },
                                finishReason: 'STOP',
                                index: 0,
                            },
                        ],
                        usageMetadata: {
                            promptTokenCount,
                            candidatesTokenCount: candidateTokenCount,
                            totalTokenCount: promptTokenCount + candidateTokenCount,
                        },
                        modelVersion: model,
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

        case 'embedContent': {
            const body = await c.req.json();
            const outputDimensionality: number | undefined = body.outputDimensionality;
            const dim = getDimension(model, outputDimensionality);

            return c.json({
                embedding: {
                    values: generateRandomVector(dim),
                },
            });
        }

        case 'batchEmbedContents': {
            const body = await c.req.json();
            const requests: Array<{ model?: string; content?: unknown; outputDimensionality?: number }>
                = body.requests ?? [];

            const embeddings = requests.map((req) => {
                const dim = getDimension(model, req.outputDimensionality);
                return { values: generateRandomVector(dim) };
            });

            return c.json({ embeddings });
        }

        default: {
            return c.json(
                {
                    error: {
                        code: 400,
                        message: `Unknown action: ${action}. Supported actions: generateContent, streamGenerateContent, embedContent, batchEmbedContents`,
                        status: 'INVALID_ARGUMENT',
                    },
                },
                400,
            );
        }
    }
});

// Not found — Google error shape
googleApp.notFound((c) => {
    return c.json(
        {
            error: {
                code: 404,
                message: `Unknown endpoint: ${c.req.method} ${c.req.path}`,
                status: 'NOT_FOUND',
            },
        },
        404,
    );
});
