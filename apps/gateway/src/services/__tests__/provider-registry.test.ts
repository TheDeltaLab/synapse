import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
    openAIConfigs: [] as Array<Record<string, unknown>>,
    anthropicConfigs: [] as Array<Record<string, unknown>>,
    googleConfigs: [] as Array<Record<string, unknown>>,
    openRouterConfigs: [] as Array<Record<string, unknown>>,
}));

type MockChatModelResult = {
    modelId: string;
    provider: string;
    baseURL?: unknown;
    hasCustomFetch?: boolean;
};

type MockEmbeddingModelResult = {
    modelId: string;
    provider: string;
    baseURL?: unknown;
};

type MockRuntime = ((modelId: string) => MockChatModelResult) & {
    textEmbeddingModel?: (modelId: string) => MockEmbeddingModelResult;
};

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn((config: Record<string, unknown>) => {
        mockState.openAIConfigs.push(config);
        const instance = vi.fn((modelId: string) => ({
            modelId,
            provider: 'openai-chat',
            baseURL: config.baseURL,
        })) as unknown as MockRuntime;
        instance.textEmbeddingModel = vi.fn((modelId: string) => ({
            modelId,
            provider: 'openai-embedding',
            baseURL: config.baseURL,
        }));
        return instance;
    }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
    createAnthropic: vi.fn((config: Record<string, unknown>) => {
        mockState.anthropicConfigs.push(config);
        return vi.fn((modelId: string) => ({
            modelId,
            provider: 'anthropic-chat',
            baseURL: config.baseURL,
        }));
    }),
}));

vi.mock('@ai-sdk/google', () => ({
    createGoogleGenerativeAI: vi.fn((config: Record<string, unknown>) => {
        mockState.googleConfigs.push(config);
        const instance = vi.fn((modelId: string) => ({
            modelId,
            provider: 'google-chat',
            baseURL: config.baseURL,
        })) as unknown as MockRuntime;
        instance.textEmbeddingModel = vi.fn((modelId: string) => ({
            modelId,
            provider: 'google-embedding',
            baseURL: config.baseURL,
        }));
        return instance;
    }),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
    createOpenRouter: vi.fn((config: Record<string, unknown>) => {
        mockState.openRouterConfigs.push(config);
        return vi.fn((modelId: string) => ({
            modelId,
            provider: 'openrouter-chat',
            baseURL: config.baseURL,
            hasCustomFetch: typeof config.fetch === 'function',
        }));
    }),
}));

const envKeys = [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'GOOGLE_API_KEY',
    'GOOGLE_BASE_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
] as const;

const originalEnv = Object.fromEntries(
    envKeys.map(key => [key, process.env[key]]),
) as Record<(typeof envKeys)[number], string | undefined>;

function clearMockState() {
    mockState.openAIConfigs.length = 0;
    mockState.anthropicConfigs.length = 0;
    mockState.googleConfigs.length = 0;
    mockState.openRouterConfigs.length = 0;
}

async function createRegistry() {
    const { ProviderRegistry } = await import('../provider-registry.js');
    return new ProviderRegistry();
}

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clearMockState();

    for (const key of envKeys) {
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of envKeys) {
        const originalValue = originalEnv[key];
        if (originalValue === undefined) {
            delete process.env[key];
            continue;
        }

        process.env[key] = originalValue;
    }
});

describe('ProviderRegistry', () => {
    it('routes declared chat deployments through the configured sdkAdapter', async () => {
        process.env.GOOGLE_API_KEY = 'test-google-key';
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

        const registry = await createRegistry();
        const googleModel = registry.getModel('google', 'gemini-2.0-flash-exp') as MockChatModelResult;
        const openRouterModel = registry.getModel('openrouter', 'gpt-5-mini') as MockChatModelResult;

        expect(googleModel.provider).toBe('google-chat');
        expect(openRouterModel.provider).toBe('openrouter-chat');
        expect(openRouterModel.hasCustomFetch).toBe(true);

        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');

        expect(vi.mocked(createGoogleGenerativeAI)).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'test-google-key',
        }));
        expect(vi.mocked(createOpenRouter)).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'test-openrouter-key',
            baseURL: 'https://openrouter.ai/api/v1',
            fetch: expect.any(Function),
        }));
    });

    it('routes declared embedding deployments through the configured sdkAdapter', async () => {
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

        const registry = await createRegistry();
        const openRouterEmbedding = registry.getEmbeddingModel('openrouter', 'qwen/qwen3-embedding-8b') as MockEmbeddingModelResult;

        expect(openRouterEmbedding.provider).toBe('openai-embedding');
        expect(openRouterEmbedding.modelId).toBe('qwen/qwen3-embedding-8b');
        expect(openRouterEmbedding.baseURL).toBe('https://openrouter.ai/api/v1');

        const { createOpenAI } = await import('@ai-sdk/openai');

        expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'test-openrouter-key',
            baseURL: 'https://openrouter.ai/api/v1',
        }));
    });

    it('falls back to the provider-native adapter for undeclared chat models', async () => {
        process.env.OPENAI_API_KEY = 'test-openai-key';

        const registry = await createRegistry();
        const model = registry.getModel('openai', 'custom-model') as MockChatModelResult;

        expect(model.provider).toBe('openai-chat');
        expect(model.modelId).toBe('custom-model');
    });

    it('reports configured provider availability and embedding support', async () => {
        process.env.OPENAI_API_KEY = 'test-openai-key';
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

        const registry = await createRegistry();

        expect(registry.hasProvider('openai')).toBe(true);
        expect(registry.hasProvider('google')).toBe(false);
        expect(registry.hasEmbeddingSupport('openai')).toBe(false);
        expect(registry.hasEmbeddingSupport('anthropic')).toBe(false);
        expect(registry.hasEmbeddingSupport('openrouter')).toBe(true);
        expect(registry.getAvailableEmbeddingProviders()).toEqual(['openrouter']);
    });

    it('throws when a provider does not support embeddings', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

        const registry = await createRegistry();

        expect(() => registry.getEmbeddingModel('anthropic', 'some-model'))
            .toThrow('does not support embeddings');
    });
});
