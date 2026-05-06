import type { ResponseStyle } from '../config/providers.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { GoogleAdapter } from './google-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import type { ProviderAdapter } from './types.js';

export type { ResponseStyle };

const providerStyleMap: Record<string, ResponseStyle> = {
    openai: 'openai',
    openrouter: 'openai',
    deepseek: 'openai',
    alibaba: 'openai',
    anthropic: 'anthropic',
    google: 'google',
};

const adapters: Record<ResponseStyle, ProviderAdapter> = {
    openai: new OpenAIAdapter(),
    anthropic: new AnthropicAdapter(),
    google: new GoogleAdapter(),
};

export function resolveResponseStyle(
    providerId: string,
    headerOverride?: string,
): ResponseStyle {
    if (headerOverride) {
        const normalized = headerOverride.toLowerCase();
        if (normalized in adapters) {
            return normalized as ResponseStyle;
        }
    }
    return providerStyleMap[providerId] ?? 'openai';
}

export function getProviderAdapter(
    providerId: string,
    headerOverride?: string,
): ProviderAdapter {
    return adapters[resolveResponseStyle(providerId, headerOverride)];
}

export type { ProviderAdapter, ParsedResponse, ParsedEmbeddingResponse, TokenUsage, ParsedRequest, RequestType, ChatMessage, RouteMatch } from './types.js';
