import { afterEach, describe, expect, it } from 'vitest';
import {
    providers,
    models,
    deployments,
    getProvider,
    getDeployment,
    getChatDeployments,
    getEmbeddingDeployments,
    getDefaultChatModel,
    getDefaultEmbeddingModel,
} from '../providers.js';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;

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

    it('defines the reduced chat and embedding model catalogs', () => {
        expect(models.map(model => model.id)).toEqual([
            'gemini-2.0-flash-exp',
            'gpt-5-mini',
            'qwen/qwen3-embedding-8b',
            'deepseek-v3.2',
        ]);
        expect(models.map(model => model.task)).toEqual([
            'chat',
            'chat',
            'embedding',
            'chat',
        ]);
    });

    it('maps every deployment to an existing provider and model', () => {
        for (const deployment of deployments) {
            expect(getProvider(deployment.providerId)).toBeDefined();
            expect(models.find(model => (
                model.id === deployment.modelId
                && model.task === deployment.task
            ))).toBeDefined();
        }
    });

    it('declares OpenRouter embedding deployments with the OpenAI adapter', () => {
        const deployment = getDeployment('openrouter', 'qwen/qwen3-embedding-8b', 'embedding');

        expect(deployment).toBeDefined();
        expect(deployment?.sdkAdapter).toBe('openai');
        expect(deployment?.upstreamModel).toBe('qwen/qwen3-embedding-8b');
    });

    it('declares OpenRouter chat deployments with the native OpenRouter adapter', () => {
        const deployment = getDeployment('openrouter', 'gpt-5-mini', 'chat');

        expect(deployment).toBeDefined();
        expect(deployment?.sdkAdapter).toBe('openrouter-sdk');
        expect(deployment?.upstreamModel).toBe('gpt-5-mini');
    });

    it('declares DeepSeek chat deployment with the OpenAI adapter and reasoning override', () => {
        const deployment = getDeployment('deepseek', 'deepseek-v3.2', 'chat');

        expect(deployment).toBeDefined();
        expect(deployment?.sdkAdapter).toBe('openai');
        expect(deployment?.upstreamModel).toBe('deepseek-chat');
        expect(deployment?.reasoningUpstreamModel).toBe('deepseek-reasoner');
        expect(deployment?.reasoningExtraBody).toEqual({ thinking: { type: 'enabled' } });
    });

    it('returns chat and embedding deployments by provider', () => {
        expect(getChatDeployments('openai')).toEqual([]);
        expect(getChatDeployments('google').map(deployment => deployment.modelId)).toEqual([
            'gemini-2.0-flash-exp',
        ]);
        expect(getChatDeployments('openrouter').map(deployment => deployment.modelId)).toEqual([
            'gpt-5-mini',
        ]);
        expect(getChatDeployments('deepseek').map(deployment => deployment.modelId)).toEqual([
            'deepseek-v3.2',
        ]);
        expect(getEmbeddingDeployments('openrouter').map(deployment => deployment.modelId)).toEqual([
            'qwen/qwen3-embedding-8b',
        ]);
        expect(getEmbeddingDeployments('anthropic')).toEqual([]);
        expect(getEmbeddingDeployments('deepseek')).toEqual([]);
    });

    it('returns default models from deployments', () => {
        expect(getDefaultChatModel('openai')).toBeUndefined();
        expect(getDefaultChatModel('google')).toBe('gemini-2.0-flash-exp');
        expect(getDefaultChatModel('openrouter')).toBe('gpt-5-mini');
        expect(getDefaultChatModel('deepseek')).toBe('deepseek-v3.2');
        expect(getDefaultEmbeddingModel('openrouter')).toBe('qwen/qwen3-embedding-8b');
        expect(getDefaultEmbeddingModel('anthropic')).toBeNull();
        expect(getDefaultEmbeddingModel('deepseek')).toBeNull();
    });
});
