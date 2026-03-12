import { describe, it, expect } from 'vitest';
import { providerConfig } from '../../config/providers.js';

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
