// Provider configuration for LLM services
export const providerConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        defaultModel: 'gpt-4o',
    },
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        defaultModel: 'claude-3-5-sonnet-20241022',
    },
    google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        defaultModel: 'gemini-2.0-flash-exp',
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        defaultModel: 'gpt-5-mini',
    },
} as const;

export type ProviderName = keyof typeof providerConfig;
