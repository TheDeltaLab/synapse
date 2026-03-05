// Provider configuration for LLM services
export const providerConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    },
    google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        defaultModel: 'gemini-2.0-flash-exp',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        defaultModel: 'gpt-5-mini',
        models: ['gpt-5-mini', 'gpt-5', 'claude-3-5-sonnet', 'gemini-2.0-flash'],
    },
} as const;

export type ProviderName = keyof typeof providerConfig;
