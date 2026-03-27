import { AnthropicAdapter } from './anthropic-adapter.js';
import { GoogleAdapter } from './google-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import type { ProviderAdapter } from './types.js';

export type ResponseStyle = 'openai' | 'anthropic' | 'google';

const providerStyleMap: Record<string, ResponseStyle> = {
    openai: 'openai',
    openrouter: 'openai',
    deepseek: 'openai',
    anthropic: 'anthropic',
    google: 'google',
};

const adapters: Record<ResponseStyle, ProviderAdapter> = {
    openai: new OpenAIAdapter(),
    anthropic: new AnthropicAdapter(),
    google: new GoogleAdapter(),
};

export function getProviderAdapter(
    providerId: string,
    headerOverride?: string,
): ProviderAdapter {
    if (headerOverride && headerOverride in adapters) {
        return adapters[headerOverride as ResponseStyle];
    }

    const style = providerStyleMap[providerId] ?? 'openai';
    return adapters[style];
}

export type { ProviderAdapter, ParsedResponse, ParsedEmbeddingResponse, TokenUsage, ParsedRequest, RequestType, ChatMessage } from './types.js';
