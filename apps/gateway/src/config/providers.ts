// Provider configuration type definition
export interface ProviderConfig {
    /** API key for authenticating with the provider */
    apiKey: string;
    /** Default chat/completion model */
    defaultModel: string;
    /** List of supported chat models */
    models: readonly string[];
    /** List of supported embedding models (empty if provider doesn't support embeddings) */
    embeddingModels: readonly string[];
    /** Default embedding model, or null if embeddings are not supported */
    defaultEmbeddingModel: string | null;
    /** Optional base URL override for the provider API (useful for proxies or mock servers) */
    baseURL?: string;
}

/**
 * Resolve an env var to a trimmed string or undefined.
 * Treats empty / whitespace-only values as unset.
 */
function envOrUndefined(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value || undefined;
}

// Provider configuration for LLM services
export const providerConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: envOrUndefined('OPENAI_BASE_URL'),
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        // Embedding models configuration
        embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
        defaultEmbeddingModel: 'text-embedding-3-small',
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        baseURL: envOrUndefined('ANTHROPIC_BASE_URL'),
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        // Anthropic does not support embeddings
        embeddingModels: [],
        defaultEmbeddingModel: null,
    },
    google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        baseURL: envOrUndefined('GOOGLE_BASE_URL'),
        defaultModel: 'gemini-2.0-flash-exp',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
        // Embedding models configuration
        embeddingModels: ['text-embedding-004'],
        defaultEmbeddingModel: 'text-embedding-004',
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseURL: envOrUndefined('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
        defaultModel: 'gpt-5-mini',
        models: ['gpt-5-mini', 'gpt-5', 'claude-3-5-sonnet', 'gemini-2.0-flash'],
        // OpenRouter supports embeddings via OpenAI-compatible interface
        embeddingModels: ['text-embedding-3-small', 'text-embedding-3-large', 'qwen/qwen3-embedding-8b'],
        defaultEmbeddingModel: 'qwen/qwen3-embedding-8b',
    },
} satisfies Record<string, ProviderConfig>;

export type ProviderName = keyof typeof providerConfig;
