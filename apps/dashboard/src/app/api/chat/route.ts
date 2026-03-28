import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { convertToModelMessages, streamText } from 'ai';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

// Providers that use the OpenAI-compatible SDK (same /v1/chat/completions path)
const OPENAI_COMPATIBLE_PROVIDERS = new Set(['openai', 'openrouter', 'deepseek']);

function createLanguageModel(
    provider: string,
    model: string,
    apiKey: string,
    headers: Record<string, string>,
): LanguageModel {
    if (provider === 'anthropic') {
        // Anthropic SDK sends to /messages (baseURL already includes /v1)
        // Uses authToken for Authorization: Bearer (gateway auth)
        const anthropic = createAnthropic({
            baseURL: `${GATEWAY_URL}/v1`,
            authToken: apiKey,
            headers,
        });
        return anthropic(model);
    }

    if (provider === 'google') {
        // Google SDK sends to /models/<model>:streamGenerateContent
        // Default baseURL includes /v1beta, so paths match gateway's Google adapter
        const google = createGoogleGenerativeAI({
            baseURL: `${GATEWAY_URL}/v1beta`,
            apiKey: 'placeholder',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...headers,
            },
        });
        return google(model);
    }

    // OpenAI-compatible providers (openai, openrouter, deepseek)
    const openai = createOpenAI({
        baseURL: `${GATEWAY_URL}/v1`,
        apiKey,
        headers,
    });
    return openai.chat(model);
}

export async function POST(request: Request) {
    const { messages, model, provider, temperature, maxOutputTokens, apiKey, cacheEnabled } = await request.json();

    const headers: Record<string, string> = {};
    if (provider && !OPENAI_COMPATIBLE_PROVIDERS.has(provider)) {
        // OpenAI-compatible providers don't need x-synapse-provider header
        // (gateway defaults to openai), but others do
        headers['x-synapse-provider'] = provider;
    }
    if (cacheEnabled === false) {
        headers['x-synapse-cache'] = 'false';
    }

    const result = streamText({
        model: createLanguageModel(provider || 'openai', model, apiKey, headers),
        messages: await convertToModelMessages(messages),
        temperature,
        maxOutputTokens,
    });

    return result.toUIMessageStreamResponse();
}
