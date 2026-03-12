import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerConfig } from '../../config/providers.js';

// Mock provider factories to avoid needing real API keys
vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn((config: any) => {
        const instance = vi.fn((modelId: string) => ({ modelId, provider: 'openai', baseURL: config.baseURL }));
        (instance as any).chat = vi.fn((modelId: string) => ({ modelId, provider: 'openai-chat', baseURL: config.baseURL }));
        (instance as any).textEmbeddingModel = vi.fn((modelId: string) => ({
            modelId,
            provider: 'openai-embedding',
            baseURL: config.baseURL,
        }));
        return instance;
    }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
    createAnthropic: vi.fn(() => {
        const instance = vi.fn((modelId: string) => ({ modelId, provider: 'anthropic' }));
        return instance;
    }),
}));

vi.mock('@ai-sdk/google', () => ({
    createGoogleGenerativeAI: vi.fn(() => {
        const instance = vi.fn((modelId: string) => ({ modelId, provider: 'google' }));
        (instance as any).textEmbeddingModel = vi.fn((modelId: string) => ({
            modelId,
            provider: 'google-embedding',
        }));
        return instance;
    }),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
    createOpenRouter: vi.fn((config: any) => {
        const instance = vi.fn((modelId: string) => ({ modelId, provider: 'openrouter', baseURL: config.baseURL }));
        (instance as any).textEmbeddingModel = vi.fn((modelId: string) => ({
            modelId,
            provider: 'openrouter-native-embedding',
            baseURL: config.baseURL,
        }));
        return instance;
    }),
}));

vi.mock('@ai-sdk/deepseek', () => ({
    createDeepSeek: vi.fn(() => {
        const instance = vi.fn((modelId: string) => ({ modelId, provider: 'deepseek' }));
        (instance as any).chat = vi.fn((modelId: string) => ({ modelId, provider: 'deepseek' }));
        return instance;
    }),
}));

vi.mock('ai', () => ({
    customProvider: vi.fn(() => ({})),
}));

/**
 * Tests for ProviderRegistry embedding functionality
 * These tests verify the embedding configuration and logic without
 * requiring actual provider initialization (which needs API keys)
 */
describe('ProviderRegistry Embedding Configuration', () => {
    describe('providerConfig embedding settings', () => {
        it('openai should have embedding models configured', () => {
            expect(providerConfig.openai.embeddingModels.length).toBeGreaterThan(0);
            expect(providerConfig.openai.embeddingModels).toContain('text-embedding-3-small');
            expect(providerConfig.openai.defaultEmbeddingModel).toBe('text-embedding-3-small');
        });

        it('anthropic should not have embedding models (unsupported)', () => {
            expect(providerConfig.anthropic.embeddingModels).toEqual([]);
            expect(providerConfig.anthropic.defaultEmbeddingModel).toBeNull();
        });

        it('google should have embedding models configured', () => {
            expect(providerConfig.google.embeddingModels.length).toBeGreaterThan(0);
            expect(providerConfig.google.embeddingModels).toContain('text-embedding-004');
            expect(providerConfig.google.defaultEmbeddingModel).toBe('text-embedding-004');
        });

        it('openrouter should have embedding models configured', () => {
            expect(providerConfig.openrouter.embeddingModels.length).toBeGreaterThan(0);
            expect(providerConfig.openrouter.defaultEmbeddingModel).not.toBeNull();
        });
    });

    describe('embedding support detection logic', () => {
        // Test the logic that would be used by hasEmbeddingSupport
        function hasEmbeddingModels(provider: keyof typeof providerConfig): boolean {
            const config = providerConfig[provider];
            return config.embeddingModels && config.embeddingModels.length > 0;
        }

        it('should detect embedding support correctly', () => {
            expect(hasEmbeddingModels('openai')).toBe(true);
            expect(hasEmbeddingModels('google')).toBe(true);
            expect(hasEmbeddingModels('openrouter')).toBe(true);
            expect(hasEmbeddingModels('anthropic')).toBe(false);
        });
    });

    describe('embedding provider filtering logic', () => {
        // Test the logic that would be used by getAvailableEmbeddingProviders
        function getProvidersWithEmbeddingSupport(): string[] {
            return (Object.keys(providerConfig) as Array<keyof typeof providerConfig>)
                .filter((provider) => {
                    const config = providerConfig[provider];
                    return config.embeddingModels && config.embeddingModels.length > 0;
                });
        }

        it('should filter providers with embedding support', () => {
            const providers = getProvidersWithEmbeddingSupport();
            expect(providers).toContain('openai');
            expect(providers).toContain('google');
            expect(providers).toContain('openrouter');
            expect(providers).not.toContain('anthropic');
        });
    });

    describe('embedding model list retrieval', () => {
        it('should return correct embedding models for each provider', () => {
            expect(providerConfig.openai.embeddingModels).toEqual([
                'text-embedding-3-small',
                'text-embedding-3-large',
                'text-embedding-ada-002',
            ]);

            expect(providerConfig.google.embeddingModels).toEqual([
                'text-embedding-004',
            ]);

            expect(providerConfig.anthropic.embeddingModels).toEqual([]);
        });
    });

    describe('default embedding model retrieval', () => {
        it('should return correct default embedding model', () => {
            expect(providerConfig.openai.defaultEmbeddingModel).toBe('text-embedding-3-small');
            expect(providerConfig.google.defaultEmbeddingModel).toBe('text-embedding-004');
            expect(providerConfig.openrouter.defaultEmbeddingModel).toBe('text-embedding-3-small');
            expect(providerConfig.anthropic.defaultEmbeddingModel).toBeNull();
        });
    });
});

describe('ProviderRegistry OpenRouter Embedding Override', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should register a dedicated embedding provider for OpenRouter using @ai-sdk/openai', async () => {
        // Set env vars so providers are registered
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

        // Dynamic import so mocks are in effect
        const { ProviderRegistry } = await import('../provider-registry.js');
        const registry = new ProviderRegistry();

        // OpenRouter chat should use the native openrouter provider
        expect(registry.hasProvider('openrouter')).toBe(true);

        // OpenRouter embedding model should come from the @ai-sdk/openai instance
        const embeddingModel = registry.getEmbeddingModel('openrouter', 'text-embedding-3-small') as any;
        expect(embeddingModel.modelId).toBe('text-embedding-3-small');
        // The dedicated embedding provider is an @ai-sdk/openai instance, so it
        // should return 'openai-embedding' from our mock (not 'openrouter-native-embedding')
        expect(embeddingModel.provider).toBe('openai-embedding');
        expect(embeddingModel.baseURL).toBe('https://openrouter.ai/api/v1');
    });

    it('should use the general provider for embedding when no dedicated embedding provider exists', async () => {
        // Set env vars for OpenAI (no dedicated embedding override needed)
        process.env.OPENAI_API_KEY = 'test-openai-key';

        const { ProviderRegistry } = await import('../provider-registry.js');
        const registry = new ProviderRegistry();

        if (registry.hasProvider('openai')) {
            const embeddingModel = registry.getEmbeddingModel('openai', 'text-embedding-3-small') as any;
            expect(embeddingModel.modelId).toBe('text-embedding-3-small');
            // Falls back to the general provider's textEmbeddingModel
            expect(embeddingModel.provider).toBe('openai-embedding');
        }
    });

    it('should throw when provider does not support embeddings', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

        const { ProviderRegistry } = await import('../provider-registry.js');
        const registry = new ProviderRegistry();

        if (registry.hasProvider('anthropic')) {
            expect(() => registry.getEmbeddingModel('anthropic', 'some-model'))
                .toThrow('does not support embeddings');
        }
    });
});
