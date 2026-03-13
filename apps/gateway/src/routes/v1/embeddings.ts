import { embedMany } from 'ai';
import type { Context } from 'hono';
import { prisma } from '@synapse/dal';
import { embeddingRequestSchema, HTTP_STATUS } from '@synapse/shared';
import type { ProviderName } from '../../config/providers.js';
import { providerRegistry } from '../../services/provider-registry.js';

/**
 * Encode float array to base64 string
 */
function encodeEmbeddingToBase64(embedding: number[]): string {
    const buffer = new Float32Array(embedding);
    const bytes = new Uint8Array(buffer.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
}

/**
 * Embedding log entry that accumulates fields as they become available
 */
interface EmbeddingLogEntry {
    apiKeyId: string;
    provider: string | null;
    model: string | null;
    inputCount: number | null;
    dimensions: number | null;
    requestContent: string | null;
    tokens: number | null;
    latency: number | null;
    statusCode: number;
}

/**
 * Persist embedding log entry to database
 */
async function saveEmbeddingLog(entry: EmbeddingLogEntry): Promise<void> {
    try {
        await prisma.embeddingLog.create({
            data: {
                apiKeyId: entry.apiKeyId,
                provider: entry.provider ?? 'unknown',
                model: entry.model ?? 'unknown',
                inputCount: entry.inputCount ?? 0,
                dimensions: entry.dimensions,
                requestContent: entry.requestContent,
                tokens: entry.tokens,
                latency: entry.latency,
                statusCode: entry.statusCode,
            },
        });
    } catch (error) {
        // Logging failures should not affect the main flow
        console.error('Failed to log embedding request:', error);
    }
}

/**
 * Handle embedding requests
 * POST /v1/embeddings
 */
export async function handleEmbeddings(c: Context): Promise<Response> {
    const startTime = Date.now();
    const apiKey = c.get('apiKey');

    // Progressively collect log fields as they become available
    const logEntry: EmbeddingLogEntry = {
        apiKeyId: apiKey.id,
        provider: null,
        model: null,
        inputCount: null,
        dimensions: null,
        requestContent: null,
        tokens: null,
        latency: null,
        statusCode: 500,
    };

    try {
        // 1. Parse and validate request
        const body = await c.req.json();
        const parseResult = embeddingRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json(
                {
                    error: {
                        message: 'Invalid request format',
                        type: 'invalid_request_error',
                        param: null,
                        code: null,
                    },
                    details: parseResult.error.errors,
                },
                HTTP_STATUS.BAD_REQUEST,
            );
        }

        const request = parseResult.data;

        // Collect parsed fields into log
        logEntry.model = request.model;
        logEntry.inputCount = Array.isArray(request.input) ? request.input.length : 1;
        logEntry.dimensions = request.dimensions ?? null;
        logEntry.requestContent = JSON.stringify(
            Array.isArray(request.input) ? request.input : [request.input],
        );

        // 2. Determine provider
        const provider = c.req.header('x-synapse-provider') as ProviderName;
        logEntry.provider = provider;

        // 3. Check if provider supports embeddings
        if (!providerRegistry.hasEmbeddingSupport(provider)) {
            const availableProviders = providerRegistry.getAvailableEmbeddingProviders();
            logEntry.statusCode = 400;
            logEntry.latency = Date.now() - startTime;
            await saveEmbeddingLog(logEntry);

            return c.json(
                {
                    error: {
                        message: `Provider '${provider}' does not support embeddings.${availableProviders.length > 0 ? ` Available providers: ${availableProviders.join(', ')}` : ''}`,
                        type: 'invalid_request_error',
                        param: 'model',
                        code: 'unsupported_provider',
                    },
                },
                HTTP_STATUS.BAD_REQUEST,
            );
        }

        // 4. Get embedding model
        const model = providerRegistry.getEmbeddingModel(provider, request.model);

        // 5. Prepare inputs
        const inputs = Array.isArray(request.input) ? request.input : [request.input];

        // 6. Call embedding API
        const result = await embedMany({
            model,
            values: inputs,
            ...(request.dimensions !== undefined && {
                providerOptions: {
                    // Always use "openai" key: all current embedding providers that
                    // support `dimensions` use @ai-sdk/openai under the hood (both
                    // native OpenAI and OpenRouter via its OpenAI-compatible wrapper).
                    openai: { dimensions: request.dimensions },
                },
            }),
        });

        // 7. Format response
        const embeddings = result.embeddings.map((embedding, index) => ({
            object: 'embedding' as const,
            index,
            embedding:
                request.encoding_format === 'base64'
                    ? encodeEmbeddingToBase64(embedding)
                    : embedding,
        }));

        // 8. Calculate token usage (from SDK result if available)
        const promptTokens = result.usage?.tokens || 0;

        // 9. Log successful request
        logEntry.tokens = promptTokens;
        logEntry.statusCode = 200;
        logEntry.latency = Date.now() - startTime;
        await saveEmbeddingLog(logEntry);

        // 10. Return OpenAI-compatible response
        return c.json({
            object: 'list',
            data: embeddings,
            model: request.model,
            usage: {
                prompt_tokens: promptTokens,
                total_tokens: promptTokens,
            },
        });
    } catch (error) {
        console.error('Embedding error:', error);

        // Log error with whatever fields were collected so far
        logEntry.statusCode = 500;
        logEntry.latency = Date.now() - startTime;
        if (apiKey?.id) {
            await saveEmbeddingLog(logEntry);
        }

        return c.json(
            {
                error: {
                    message: error instanceof Error ? error.message : 'Failed to generate embeddings',
                    type: 'api_error',
                    param: null,
                    code: null,
                },
            },
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
        );
    }
}
