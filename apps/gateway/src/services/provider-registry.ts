import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { EmbeddingModel, LanguageModel } from 'ai';
import {
    providers,
    getProvider as findProvider,
    getDeployment,
    getEmbeddingDeployments,
    getDefaultEmbeddingModel as getConfiguredDefaultEmbeddingModel,
    type Provider,
    type ProviderName,
    type SdkAdapter,
} from '../config/providers.js';

type LanguageModelV3 = Extract<LanguageModel, { specificationVersion: 'v3' }>;
type RuntimeInstance = {
    (modelId: string): LanguageModelV3;
    textEmbeddingModel?: (modelId: string) => EmbeddingModel;
};

/**
 * Custom fetch wrapper that normalizes OpenRouter streaming responses.
 * Fixes missing `index` field in chunks, which causes Zod validation errors in AI SDK.
 */
function createNormalizingFetch(originalFetch: typeof fetch = fetch): typeof fetch {
    return async (url, init) => {
        const response = await originalFetch(url, init);

        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
            return response;
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        (async () => {
            try {
                const reader = response.body!.getReader();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            try {
                                const jsonStr = line.slice(6);
                                const data = JSON.parse(jsonStr);

                                if (data.choices && Array.isArray(data.choices)) {
                                    data.choices = data.choices.map((choice: Record<string, unknown>, idx: number) => ({
                                        index: idx,
                                        ...choice,
                                    }));
                                }

                                await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                            } catch {
                                await writer.write(encoder.encode(line + '\n'));
                            }
                        } else {
                            await writer.write(encoder.encode(line + '\n'));
                        }
                    }
                }

                if (buffer) {
                    await writer.write(encoder.encode(buffer));
                }
            } catch (error) {
                console.error('[NormalizingFetch] Stream processing error:', error);
            } finally {
                await writer.close();
            }
        })();

        return new Response(readable, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    };
}

export class ProviderRegistry {
    private runtimeInstances = new Map<string, RuntimeInstance>();

    private getRuntimeKey(sdkAdapter: SdkAdapter, providerId: ProviderName): string {
        return `${sdkAdapter}:${providerId}`;
    }

    private getFallbackAdapter(providerId: ProviderName): SdkAdapter {
        switch (providerId) {
            case 'openai':
            case 'anthropic':
            case 'google':
                return providerId;
            case 'openrouter':
                return 'openrouter-sdk';
            default:
                throw new Error(`Unsupported provider adapter mapping for ${providerId}`);
        }
    }

    private getOrCreateRuntime(sdkAdapter: SdkAdapter, provider: Provider): RuntimeInstance {
        const key = this.getRuntimeKey(sdkAdapter, provider.id as ProviderName);
        const existingRuntime = this.runtimeInstances.get(key);
        if (existingRuntime) {
            return existingRuntime;
        }

        if (!provider.apiKey) {
            throw new Error(`Provider ${provider.id} not found or not configured`);
        }

        let runtime: RuntimeInstance;

        switch (sdkAdapter) {
            case 'openai':
                runtime = createOpenAI({
                    apiKey: provider.apiKey,
                    baseURL: provider.baseUrl,
                }) as RuntimeInstance;
                break;
            case 'anthropic':
                runtime = createAnthropic({
                    apiKey: provider.apiKey,
                    baseURL: provider.baseUrl,
                }) as RuntimeInstance;
                break;
            case 'google':
                runtime = createGoogleGenerativeAI({
                    apiKey: provider.apiKey,
                    baseURL: provider.baseUrl,
                }) as RuntimeInstance;
                break;
            case 'openrouter-sdk':
                runtime = createOpenRouter({
                    apiKey: provider.apiKey,
                    baseURL: provider.baseUrl,
                    fetch: createNormalizingFetch(),
                }) as RuntimeInstance;
                break;
        }

        this.runtimeInstances.set(key, runtime);
        return runtime;
    }

    getProvider(name: ProviderName): RuntimeInstance | undefined {
        const provider = findProvider(name);
        if (!provider?.apiKey) {
            return undefined;
        }

        return this.getOrCreateRuntime(this.getFallbackAdapter(name), provider);
    }

    getModel(providerId: ProviderName, modelId: string): LanguageModelV3 {
        const deployment = getDeployment(providerId, modelId, 'chat');
        if (deployment) {
            const provider = findProvider(deployment.providerId);
            if (!provider) {
                throw new Error(`Provider ${providerId} not found or not configured`);
            }

            return this.getOrCreateRuntime(deployment.sdkAdapter, provider)(deployment.upstreamModel);
        }

        const provider = findProvider(providerId);
        if (!provider?.apiKey) {
            throw new Error(`Provider ${providerId} not found or not configured`);
        }

        return this.getOrCreateRuntime(this.getFallbackAdapter(providerId), provider)(modelId);
    }

    hasProvider(name: ProviderName): boolean {
        return Boolean(findProvider(name)?.apiKey);
    }

    getAvailableProviders(): ProviderName[] {
        return providers
            .filter(provider => this.hasProvider(provider.id))
            .map(provider => provider.id);
    }

    hasEmbeddingSupport(providerId: ProviderName): boolean {
        return this.hasProvider(providerId) && getEmbeddingDeployments(providerId).length > 0;
    }

    getAvailableEmbeddingProviders(): ProviderName[] {
        return this.getAvailableProviders().filter(providerId => this.hasEmbeddingSupport(providerId));
    }

    getEmbeddingModel(providerId: ProviderName, modelId: string): EmbeddingModel {
        const provider = findProvider(providerId);
        if (!provider?.apiKey) {
            throw new Error(`Provider ${providerId} not found or not configured`);
        }

        const embeddingDeployments = getEmbeddingDeployments(providerId);
        if (embeddingDeployments.length === 0) {
            throw new Error(`Provider ${providerId} does not support embeddings`);
        }

        const deployment = getDeployment(providerId, modelId, 'embedding');
        if (!deployment) {
            throw new Error(`Embedding model ${modelId} not configured for provider ${providerId}`);
        }

        const runtime = this.getOrCreateRuntime(deployment.sdkAdapter, provider);
        if (typeof runtime.textEmbeddingModel !== 'function') {
            throw new Error(`Provider ${providerId} does not expose embedding model method`);
        }

        return runtime.textEmbeddingModel(deployment.upstreamModel);
    }

    getEmbeddingModels(providerId: ProviderName): readonly string[] {
        return getEmbeddingDeployments(providerId).map(deployment => deployment.modelId);
    }

    getDefaultEmbeddingModel(providerId: ProviderName): string | null {
        return getConfiguredDefaultEmbeddingModel(providerId);
    }
}

export const providerRegistry = new ProviderRegistry();
