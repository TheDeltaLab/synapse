import { afterEach, describe, expect, it } from 'vitest';
import {
    providers,
    deployments,
    getProvider,
    getDeployment,
    findDeploymentByModel,
    getChatDeployments,
    getEmbeddingDeployments,
    getDefaultChatModel,
    getDefaultEmbeddingModel,
    getAvailableProviders,
    hasEmbeddingSupport,
    getAvailableEmbeddingProviders,
} from '../providers.js';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;
const originalGoogleApiKey = process.env.GOOGLE_API_KEY;

afterEach(() => {
    if (originalOpenRouterApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
    } else {
        process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    }

    if (originalDeepSeekApiKey === undefined) {
        delete process.env.DEEPSEEK_API_KEY;
    } else {
        process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
    }

    if (originalGoogleApiKey === undefined) {
        delete process.env.GOOGLE_API_KEY;
    } else {
        process.env.GOOGLE_API_KEY = originalGoogleApiKey;
    }
});

describe('providers config', () => {
    it('defines all supported providers', () => {
        expect(providers.map(provider => provider.id)).toEqual([
            'openai',
            'anthropic',
            'google',
            'openrouter',
            'deepseek',
        ]);
    });

    it('instantiates provider-specific classes', () => {
        expect(getProvider('openai')?.constructor.name).toBe('OpenAIProvider');
        expect(getProvider('anthropic')?.constructor.name).toBe('AnthropicProvider');
        expect(getProvider('google')?.constructor.name).toBe('GoogleProvider');
        expect(getProvider('openrouter')?.constructor.name).toBe('OpenRouterProvider');
        expect(getProvider('deepseek')?.constructor.name).toBe('DeepSeekProvider');
    });

    it('reads provider API keys through env-backed methods', () => {
        process.env.OPENROUTER_API_KEY = '  test-openrouter-key  ';
        process.env.DEEPSEEK_API_KEY = '  test-deepseek-key  ';

        expect(getProvider('openrouter')?.getApiKey()).toBe('test-openrouter-key');
        expect(getProvider('openrouter')?.isAvailable()).toBe(true);
        expect(getProvider('deepseek')?.getApiKey()).toBe('test-deepseek-key');
        expect(getProvider('deepseek')?.isAvailable()).toBe(true);
        expect(getProvider('openai')?.isAvailable()).toBe(false);
    });

    it('maps every deployment to an existing provider', () => {
        for (const deployment of deployments) {
            expect(getProvider(deployment.providerId)).toBeDefined();
        }
    });

    it('has required baseUrl on all providers', () => {
        for (const provider of providers) {
            expect(typeof provider.baseUrl).toBe('string');
            expect(provider.baseUrl.length).toBeGreaterThan(0);
        }
    });

    it('sets default baseUrls correctly (when no env override)', () => {
        // These tests verify the expected defaults. If a *_BASE_URL env var is set,
        // the provider will use that value instead — which is correct behavior.
        const openai = getProvider('openai')!;
        const anthropic = getProvider('anthropic')!;
        const google = getProvider('google')!;
        const openrouter = getProvider('openrouter')!;
        const deepseek = getProvider('deepseek')!;

        if (!process.env.OPENAI_BASE_URL) {
            expect(openai.baseUrl).toBe('https://api.openai.com');
        }
        if (!process.env.ANTHROPIC_BASE_URL) {
            expect(anthropic.baseUrl).toBe('https://api.anthropic.com');
        }
        if (!process.env.GOOGLE_BASE_URL) {
            expect(google.baseUrl).toBe('https://generativelanguage.googleapis.com');
        }
        if (!process.env.OPENROUTER_BASE_URL) {
            expect(openrouter.baseUrl).toBe('https://openrouter.ai/api');
        }
        if (!process.env.DEEPSEEK_BASE_URL) {
            expect(deepseek.baseUrl).toBe('https://api.deepseek.com');
        }

        // All providers must have a non-empty baseUrl regardless
        expect(openai.baseUrl.length).toBeGreaterThan(0);
        expect(anthropic.baseUrl.length).toBeGreaterThan(0);
        expect(google.baseUrl.length).toBeGreaterThan(0);
        expect(openrouter.baseUrl.length).toBeGreaterThan(0);
        expect(deepseek.baseUrl.length).toBeGreaterThan(0);
    });

    it('returns Bearer auth headers by default', () => {
        process.env.OPENROUTER_API_KEY = 'test-key';
        const provider = getProvider('openrouter')!;
        const headers = provider.getAuthHeaders();
        expect(headers).toEqual({ Authorization: 'Bearer test-key' });
    });

    it('returns Anthropic-specific auth headers', () => {
        const provider = getProvider('anthropic')!;
        // Set a key so getApiKey returns a non-empty value
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
        const headers = provider.getAuthHeaders();
        expect(headers).toEqual({
            'x-api-key': 'test-anthropic-key',
            'anthropic-version': '2023-06-01',
        });
    });

    it('declares Anthropic chat deployments', () => {
        const sonnet = getDeployment('anthropic', 'claude-sonnet-4-6', 'chat');
        expect(sonnet).toBeDefined();
        expect(sonnet?.isDefault).toBe(true);

        const opus = getDeployment('anthropic', 'claude-opus-4-6', 'chat');
        expect(opus).toBeDefined();

        const haiku = getDeployment('anthropic', 'claude-haiku-4-5-20251001', 'chat');
        expect(haiku).toBeDefined();
    });

    it('declares OpenRouter embedding deployment', () => {
        const deployment = getDeployment('openrouter', 'qwen/qwen3-embedding-8b', 'embedding');

        expect(deployment).toBeDefined();
        expect(deployment?.modelId).toBe('qwen/qwen3-embedding-8b');
    });

    it('declares DeepSeek chat deployment with upstream model name', () => {
        const deployment = getDeployment('deepseek', 'deepseek-chat', 'chat');

        expect(deployment).toBeDefined();
        expect(deployment?.modelId).toBe('deepseek-chat');
    });

    it('declares a separate deepseek-reasoner deployment', () => {
        const deployment = getDeployment('deepseek', 'deepseek-reasoner', 'chat');

        expect(deployment).toBeDefined();
        expect(deployment?.modelId).toBe('deepseek-reasoner');
    });

    it('returns chat and embedding deployments by provider', () => {
        expect(getChatDeployments('openai')).toEqual([]);
        expect(getChatDeployments('anthropic').map(deployment => deployment.modelId)).toEqual([
            'claude-sonnet-4-6',
            'claude-opus-4-6',
            'claude-haiku-4-5-20251001',
        ]);
        expect(getChatDeployments('google').map(deployment => deployment.modelId)).toEqual([
            'gemini-2.0-flash-exp',
        ]);
        expect(getChatDeployments('openrouter').map(deployment => deployment.modelId)).toEqual([
            'gpt-5-mini',
        ]);
        expect(getChatDeployments('deepseek').map(deployment => deployment.modelId)).toEqual([
            'deepseek-chat',
            'deepseek-reasoner',
        ]);
        expect(getEmbeddingDeployments('openrouter').map(deployment => deployment.modelId)).toEqual([
            'qwen/qwen3-embedding-8b',
        ]);
        expect(getEmbeddingDeployments('anthropic')).toEqual([]);
        expect(getEmbeddingDeployments('deepseek')).toEqual([]);
    });

    it('returns default models from deployments', () => {
        expect(getDefaultChatModel('openai')).toBeUndefined();
        expect(getDefaultChatModel('anthropic')).toBe('claude-sonnet-4-6');
        expect(getDefaultChatModel('google')).toBe('gemini-2.0-flash-exp');
        expect(getDefaultChatModel('openrouter')).toBe('gpt-5-mini');
        expect(getDefaultChatModel('deepseek')).toBe('deepseek-chat');
        expect(getDefaultEmbeddingModel('openrouter')).toBe('qwen/qwen3-embedding-8b');
        expect(getDefaultEmbeddingModel('anthropic')).toBeNull();
        expect(getDefaultEmbeddingModel('deepseek')).toBeNull();
    });

    describe('findDeploymentByModel', () => {
        it('finds deployment by model name across providers', () => {
            const deployment = findDeploymentByModel('gpt-5-mini', 'chat');
            expect(deployment).toBeDefined();
            expect(deployment?.providerId).toBe('openrouter');
        });

        it('returns undefined for unknown models', () => {
            expect(findDeploymentByModel('unknown-model', 'chat')).toBeUndefined();
        });

        it('matches task type correctly', () => {
            // qwen/qwen3-embedding-8b is an embedding model, not chat
            expect(findDeploymentByModel('qwen/qwen3-embedding-8b', 'chat')).toBeUndefined();
            expect(findDeploymentByModel('qwen/qwen3-embedding-8b', 'embedding')).toBeDefined();
        });

        it('finds deployment without task filter', () => {
            const deployment = findDeploymentByModel('gpt-5-mini');
            expect(deployment).toBeDefined();
            expect(deployment?.providerId).toBe('openrouter');
            expect(deployment?.task).toBe('chat');
        });

        it('finds embedding deployment without task filter', () => {
            const deployment = findDeploymentByModel('qwen/qwen3-embedding-8b');
            expect(deployment).toBeDefined();
            expect(deployment?.task).toBe('embedding');
        });
    });

    describe('getAvailableProviders', () => {
        it('returns only providers with API keys set', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEEPSEEK_API_KEY = 'test-key';

            const available = getAvailableProviders();
            expect(available).toContain('openrouter');
            expect(available).toContain('deepseek');
            expect(available).not.toContain('openai');
        });
    });

    describe('hasEmbeddingSupport', () => {
        it('returns true for providers with embedding deployments and API keys', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            expect(hasEmbeddingSupport('openrouter')).toBe(true);
        });

        it('returns false for providers without embedding deployments', () => {
            process.env.DEEPSEEK_API_KEY = 'test-key';
            expect(hasEmbeddingSupport('deepseek')).toBe(false);
        });

        it('returns false for providers without API keys', () => {
            expect(hasEmbeddingSupport('openrouter')).toBe(false);
        });
    });

    describe('getAvailableEmbeddingProviders', () => {
        it('returns only providers with both embedding support and API keys', () => {
            process.env.OPENROUTER_API_KEY = 'test-key';
            process.env.DEEPSEEK_API_KEY = 'test-key';

            expect(getAvailableEmbeddingProviders()).toEqual(['openrouter']);
        });
    });
});
