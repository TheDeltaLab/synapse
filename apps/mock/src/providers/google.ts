import { Hono } from 'hono';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';
import { generateRandomVector, getDimension } from '../utils/vectors.js';

export const googleApp = new Hono();

// Health check
googleApp.get('/health', c => c.json({ status: 'ok', provider: 'google-mock' }));

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
                        message: `Unknown action: ${action}. Supported actions: generateContent, embedContent, batchEmbedContents`,
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
