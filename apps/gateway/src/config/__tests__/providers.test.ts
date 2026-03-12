import { describe, it, expect } from 'vitest';
import { providerConfig } from '../providers.js';

describe('providerConfig', () => {
    describe('structure', () => {
        it('should have all required providers', () => {
            expect(providerConfig).toHaveProperty('openai');
            expect(providerConfig).toHaveProperty('anthropic');
            expect(providerConfig).toHaveProperty('google');
            expect(providerConfig).toHaveProperty('openrouter');
        });

        it('should have required fields for each provider', () => {
            const providers = ['openai', 'anthropic', 'google', 'openrouter'] as const;

            for (const provider of providers) {
                const config = providerConfig[provider];
                expect(config).toHaveProperty('apiKey');
                expect(config).toHaveProperty('defaultModel');
                expect(config).toHaveProperty('models');
                expect(config).toHaveProperty('embeddingModels');
                expect(config).toHaveProperty('defaultEmbeddingModel');
                expect(Array.isArray(config.models)).toBe(true);
                expect(Array.isArray(config.embeddingModels)).toBe(true);
            }
        });

        it('should have optional baseURL field for each provider', () => {
            const providers = ['openai', 'anthropic', 'google', 'openrouter'] as const;

            for (const provider of providers) {
                const config = providerConfig[provider];
                expect(config).toHaveProperty('baseURL');
            }
        });
    });

    describe('openai config', () => {
        it('should have correct embedding models', () => {
            expect(providerConfig.openai.embeddingModels).toContain('text-embedding-3-small');
            expect(providerConfig.openai.embeddingModels).toContain('text-embedding-3-large');
            expect(providerConfig.openai.embeddingModels).toContain('text-embedding-ada-002');
        });

        it('should have default embedding model', () => {
            expect(providerConfig.openai.defaultEmbeddingModel).toBe('text-embedding-3-small');
        });

        it('should have chat models', () => {
            expect(providerConfig.openai.models.length).toBeGreaterThan(0);
            expect(providerConfig.openai.defaultModel).toBe('gpt-4o');
        });
    });

    describe('anthropic config', () => {
        it('should not have embedding models (unsupported)', () => {
            expect(providerConfig.anthropic.embeddingModels).toEqual([]);
            expect(providerConfig.anthropic.defaultEmbeddingModel).toBeNull();
        });

        it('should have chat models', () => {
            expect(providerConfig.anthropic.models.length).toBeGreaterThan(0);
        });
    });

    describe('google config', () => {
        it('should have correct embedding models', () => {
            expect(providerConfig.google.embeddingModels).toContain('text-embedding-004');
        });

        it('should have default embedding model', () => {
            expect(providerConfig.google.defaultEmbeddingModel).toBe('text-embedding-004');
        });
    });

    describe('openrouter config', () => {
        it('should have embedding models', () => {
            expect(providerConfig.openrouter.embeddingModels.length).toBeGreaterThan(0);
        });

        it('should have default embedding model', () => {
            expect(providerConfig.openrouter.defaultEmbeddingModel).not.toBeNull();
        });
    });
});
