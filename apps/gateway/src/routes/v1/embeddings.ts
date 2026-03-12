import { embedMany } from 'ai';
import type { Context } from 'hono';
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
 * Determine provider from model name
 */
function determineEmbeddingProvider(model: string): ProviderName {
    // OpenAI embedding models
    if (model.startsWith('text-embedding-')) {
        return 'openai';
    }
    // Google embedding models
    if (model.includes('gecko') || model === 'text-embedding-004') {
        return 'google';
    }
    // Default to OpenAI
    return 'openai';
}

/**
 * Handle embedding requests
 * POST /v1/embeddings
 */
export async function handleEmbeddings(c: Context): Promise<Response> {
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

        // 2. Determine provider
        const providerHeader = c.req.header('x-synapse-provider');
        const provider = (providerHeader as ProviderName) || determineEmbeddingProvider(request.model);

        // 3. Check if provider supports embeddings
        if (!providerRegistry.hasEmbeddingSupport(provider)) {
            const availableProviders = providerRegistry.getAvailableEmbeddingProviders();
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

        // 9. Log request (will be implemented in M3)
        // TODO: Implement embedding request logging

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
