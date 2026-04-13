import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envKeys = [
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'GOOGLE_API_KEY',
    'GOOGLE_BASE_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_BASE_URL',
] as const;

const originalEnv = Object.fromEntries(
    envKeys.map(key => [key, process.env[key]]),
) as Record<(typeof envKeys)[number], string | undefined>;

async function createRegistry() {
    const { ProviderRegistry } = await import('../provider-registry.js');
    return new ProviderRegistry();
}

beforeEach(() => {
    vi.resetModules();

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
    describe('resolveEndpoint', () => {
        it('resolves endpoint with explicit provider and known deployment', async () => {
            process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/chat/completions',
                'deepseek-chat',
                'chat',
                'deepseek',
            );

            expect(endpoint.url).toBe('https://api.deepseek.com/v1/chat/completions');
            expect(endpoint.headers['Authorization']).toBe('Bearer test-deepseek-key');
            expect(endpoint.headers['Content-Type']).toBeUndefined();
            expect(endpoint.providerId).toBe('deepseek');
            expect(endpoint.deployment).toBeDefined();
            expect(endpoint.deployment?.modelId).toBe('deepseek-chat');
        });

        it('resolves endpoint with explicit provider for unknown model (fallback)', async () => {
            process.env.OPENAI_API_KEY = 'test-openai-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/chat/completions',
                'gpt-4o',
                'chat',
                'openai',
            );

            expect(endpoint.url).toBe('https://api.openai.com/v1/chat/completions');
            expect(endpoint.headers['Authorization']).toBe('Bearer test-openai-key');
            expect(endpoint.deployment).toBeNull();
            expect(endpoint.providerId).toBe('openai');
        });

        it('resolves endpoint via model-based routing (no provider specified)', async () => {
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/chat/completions',
                'gpt-5-mini',
                'chat',
            );

            expect(endpoint.url).toBe('https://openrouter.ai/api/v1/chat/completions');
            expect(endpoint.headers['Authorization']).toBe('Bearer test-openrouter-key');
            expect(endpoint.providerId).toBe('openrouter');
            expect(endpoint.deployment?.modelId).toBe('gpt-5-mini');
        });

        it('resolves Anthropic endpoint with custom auth headers', async () => {
            process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/messages',
                'claude-sonnet-4-20250514',
                'chat',
                'anthropic',
            );

            expect(endpoint.url).toBe('https://api.anthropic.com/v1/messages');
            expect(endpoint.headers['x-api-key']).toBe('test-anthropic-key');
            expect(endpoint.headers['anthropic-version']).toBe('2023-06-01');
            expect(endpoint.headers['Authorization']).toBeUndefined();
        });

        it('resolves embedding endpoint via model-based routing', async () => {
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/embeddings',
                'qwen/qwen3-embedding-8b',
                'embedding',
            );

            expect(endpoint.url).toBe('https://openrouter.ai/api/v1/embeddings');
            expect(endpoint.providerId).toBe('openrouter');
        });

        it('throws for unknown model when no provider specified', async () => {
            const registry = await createRegistry();

            expect(() => registry.resolveEndpoint(
                '/v1/chat/completions',
                'unknown-model',
                'chat',
            )).toThrow('No deployment found for model unknown-model');
        });

        it('defaults to OpenAI when neither model nor provider specified', async () => {
            process.env.OPENAI_API_KEY = 'test-openai-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint('/v1/models');

            expect(endpoint.url).toBe('https://api.openai.com/v1/models');
            expect(endpoint.headers['Authorization']).toBe('Bearer test-openai-key');
            expect(endpoint.providerId).toBe('openai');
            expect(endpoint.deployment).toBeNull();
        });

        it('resolves with only providerId and no model (e.g. GET requests)', async () => {
            process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/models',
                undefined,
                undefined,
                'deepseek',
            );

            expect(endpoint.url).toBe('https://api.deepseek.com/v1/models');
            expect(endpoint.headers['Authorization']).toBe('Bearer test-deepseek-key');
            expect(endpoint.providerId).toBe('deepseek');
            expect(endpoint.deployment).toBeNull();
        });

        it('resolves with model but no task', async () => {
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/chat/completions',
                'gpt-5-mini',
            );

            expect(endpoint.url).toBe('https://openrouter.ai/api/v1/chat/completions');
            expect(endpoint.providerId).toBe('openrouter');
            expect(endpoint.deployment?.modelId).toBe('gpt-5-mini');
        });

        it('throws when specified provider is not configured', async () => {
            const registry = await createRegistry();

            expect(() => registry.resolveEndpoint(
                '/v1/chat/completions',
                'some-model',
                'chat',
                'openai',
            )).toThrow('Provider openai not found or not configured');
        });

        it('uses custom base URL from environment', async () => {
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.OPENAI_BASE_URL = 'https://custom.openai.com';

            const registry = await createRegistry();
            const endpoint = registry.resolveEndpoint(
                '/v1/chat/completions',
                'gpt-4o',
                'chat',
                'openai',
            );

            expect(endpoint.url).toBe('https://custom.openai.com/v1/chat/completions');
        });
    });

    describe('provider availability', () => {
        it('reports configured provider availability and embedding support', async () => {
            process.env.OPENAI_API_KEY = 'test-openai-key';
            process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
            process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

            const registry = await createRegistry();

            expect(registry.hasProvider('openai')).toBe(true);
            expect(registry.hasProvider('google')).toBe(false);
            expect(registry.hasProvider('deepseek')).toBe(true);
            expect(registry.hasEmbeddingSupport('openai')).toBe(false);
            expect(registry.hasEmbeddingSupport('anthropic')).toBe(false);
            expect(registry.hasEmbeddingSupport('openrouter')).toBe(true);
            expect(registry.hasEmbeddingSupport('deepseek')).toBe(false);
            expect(registry.getAvailableEmbeddingProviders()).toEqual(['openrouter']);
        });

        it('treats disabled providers as unavailable', async () => {
            process.env.OPENAI_API_KEY = 'test-openai-key';

            const registry = await createRegistry();
            const { getProvider: getConfiguredProvider } = await import('../../config/providers.js');
            const provider = getConfiguredProvider('openai');

            expect(provider).toBeDefined();
            Object.defineProperty(provider!, 'enabled', {
                value: false,
                configurable: true,
            });

            expect(registry.hasProvider('openai')).toBe(false);
            expect(registry.getAvailableProviders()).toEqual([]);
            expect(() => registry.resolveEndpoint('/v1/chat/completions', 'gpt-4o', 'chat', 'openai'))
                .toThrow('Provider openai not found or not configured');
        });
    });

    describe('embedding methods', () => {
        it('returns embedding models for a provider', async () => {
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

            const registry = await createRegistry();
            expect(registry.getEmbeddingModels('openrouter')).toEqual(['qwen/qwen3-embedding-8b', 'qwen/qwen3-embedding-4b']);
        });

        it('returns default embedding model', async () => {
            process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

            const registry = await createRegistry();
            expect(registry.getDefaultEmbeddingModel('openrouter')).toBe('qwen/qwen3-embedding-8b');
            expect(registry.getDefaultEmbeddingModel('anthropic')).toBeNull();
        });
    });
});
