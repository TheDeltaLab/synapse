import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingModel } from 'ai';
import { embed, embedMany } from 'ai';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

function createEmbeddingModel(
    provider: string,
    model: string,
    apiKey: string,
    headers: Record<string, string>,
): EmbeddingModel {
    if (provider === 'google') {
        const google = createGoogleGenerativeAI({
            baseURL: `${GATEWAY_URL}/v1beta`,
            apiKey: 'placeholder',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...headers,
            },
        });
        return google.embedding(model);
    }

    // OpenAI-compatible providers (openai, openrouter, deepseek, alibaba)
    const openai = createOpenAI({
        baseURL: `${GATEWAY_URL}/v1`,
        apiKey,
        headers,
    });
    return openai.embedding(model);
}

export async function POST(request: Request) {
    const { input, model, provider, dimensions, apiKey, cacheEnabled } = await request.json();

    const headers: Record<string, string> = {};
    if (provider) {
        headers['x-synapse-provider'] = provider;
    }
    if (cacheEnabled === false) {
        headers['x-synapse-cache'] = 'false';
    }

    const embeddingModel = createEmbeddingModel(provider || 'openai', model, apiKey, headers);
    const providerOptions = dimensions ? { openai: { dimensions } } : undefined;

    if (Array.isArray(input)) {
        const result = await embedMany({
            model: embeddingModel,
            values: input,
            ...(providerOptions ? { providerOptions } : {}),
        });
        return Response.json({
            embeddings: result.embeddings,
            usage: { tokens: result.usage.tokens },
        });
    }

    const result = await embed({
        model: embeddingModel,
        value: input,
        ...(providerOptions ? { providerOptions } : {}),
    });

    return Response.json({
        embedding: result.embedding,
        usage: { tokens: result.usage.tokens },
    });
}
