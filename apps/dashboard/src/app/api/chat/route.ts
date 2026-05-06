import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { convertToModelMessages, streamText } from 'ai';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

type ResponseStyle = 'openai' | 'anthropic' | 'google';

function createLanguageModel(
    style: ResponseStyle,
    model: string,
    apiKey: string,
    headers: Record<string, string>,
): LanguageModel {
    if (style === 'anthropic') {
        // Anthropic SDK posts to /v1/messages and uses authToken for Bearer (gateway auth).
        const anthropic = createAnthropic({
            baseURL: `${GATEWAY_URL}/v1`,
            authToken: apiKey,
            headers,
        });
        return anthropic(model);
    }

    if (style === 'google') {
        // Google SDK posts to /v1beta/models/<model>:streamGenerateContent.
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

    // OpenAI-style: /v1/chat/completions
    const openai = createOpenAI({
        baseURL: `${GATEWAY_URL}/v1`,
        apiKey,
        headers,
    });
    return openai.chat(model);
}

// Gateway defaults to provider=openai when x-synapse-provider is absent,
// so the header can be omitted for openai itself.
const PROVIDERS_REQUIRING_HEADER = (providerId: string) => providerId && providerId !== 'openai';

export async function POST(request: Request) {
    const {
        messages,
        model,
        provider,
        responseStyle,
        temperature,
        maxOutputTokens,
        apiKey,
        cacheEnabled,
    } = await request.json();

    const style: ResponseStyle = (responseStyle as ResponseStyle | undefined) || 'openai';

    const headers: Record<string, string> = {};
    if (PROVIDERS_REQUIRING_HEADER(provider)) {
        headers['x-synapse-provider'] = provider;
    }
    headers['x-synapse-response-style'] = style;
    if (cacheEnabled === false) {
        headers['x-synapse-cache'] = 'false';
    }

    const result = streamText({
        model: createLanguageModel(style, model, apiKey, headers),
        messages: await convertToModelMessages(messages),
        temperature,
        maxOutputTokens,
    });

    return result.toUIMessageStreamResponse();
}
