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

/**
 * Custom fetch wrapper that injects extra fields into JSON request bodies.
 * Used to pass provider-specific parameters (e.g. DeepSeek thinking mode).
 */
function createBodyInjectingFetch(
    extraBody: Record<string, unknown>,
    originalFetch: typeof fetch = fetch,
): typeof fetch {
    return async (url, init) => {
        if (init?.body && typeof init.body === 'string') {
            try {
                const body = JSON.parse(init.body);
                Object.assign(body, extraBody);
                init = { ...init, body: JSON.stringify(body) };
            } catch {
                // Not JSON, pass through unchanged
            }
        }
        return originalFetch(url, init);
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
            case 'deepseek':
                return 'openai';
            default:
                throw new Error(`Unsupported provider adapter mapping for ${providerId}`);
        }
    }

    private getOrCreateRuntime(
        sdkAdapter: SdkAdapter,
        provider: Provider,
        extraBody?: Record<string, unknown>,
    ): RuntimeInstance {
        const keySuffix = extraBody ? ':reasoning' : '';
        const key = this.getRuntimeKey(sdkAdapter, provider.id as ProviderName) + keySuffix;
        const existingRuntime = this.runtimeInstances.get(key);
        if (existingRuntime) {
            return existingRuntime;
        }

        if (!provider.isAvailable()) {
            throw new Error(`Provider ${provider.id} not found or not configured`);
        }

        let runtime: RuntimeInstance;

        switch (sdkAdapter) {
            case 'openai': {
                const openai = createOpenAI({
                    apiKey: provider.getApiKey(),
                    baseURL: provider.baseUrl,
                    ...(extraBody && { fetch: createBodyInjectingFetch(extraBody) }),
                });
                // Use .chat() to target the Chat Completions API (/v1/chat/completions).
                // The default callable uses the Responses API (/v1/responses) which is
                // not supported by OpenAI-compatible third-party providers like DeepSeek.
                const chatRuntime = ((modelId: string) => openai.chat(modelId)) as unknown as RuntimeInstance;
                chatRuntime.textEmbeddingModel = openai.textEmbeddingModel;
                runtime = chatRuntime;
                break;
            }
            case 'anthropic':
                runtime = createAnthropic({
                    apiKey: provider.getApiKey(),
                    baseURL: provider.baseUrl,
                }) as RuntimeInstance;
                break;
            case 'google':
                runtime = createGoogleGenerativeAI({
                    apiKey: provider.getApiKey(),
                    baseURL: provider.baseUrl,
                }) as RuntimeInstance;
                break;
            case 'openrouter-sdk':
                runtime = createOpenRouter({
                    apiKey: provider.getApiKey(),
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
        if (!provider?.isAvailable()) {
            return undefined;
        }

        return this.getOrCreateRuntime(this.getFallbackAdapter(name), provider);
    }

    getModel(
        providerId: ProviderName,
        modelId: string,
        options?: { reasoning?: { effort: string } },
    ): LanguageModelV3 {
        const deployment = getDeployment(providerId, modelId, 'chat');
        if (deployment) {
            const provider = findProvider(deployment.providerId);
            if (!provider) {
                throw new Error(`Provider ${providerId} not found or not configured`);
            }

            const useReasoning = deployment.reasoningUpstreamModel
                && options?.reasoning != null
                && options.reasoning.effort !== 'none';
            const upstreamModel = useReasoning
                ? deployment.reasoningUpstreamModel!
                : deployment.upstreamModel;
            const extraBody = useReasoning ? deployment.reasoningExtraBody : undefined;

            return this.getOrCreateRuntime(deployment.sdkAdapter, provider, extraBody)(upstreamModel);
        }

        const provider = findProvider(providerId);
        if (!provider?.isAvailable()) {
            throw new Error(`Provider ${providerId} not found or not configured`);
        }

        return this.getOrCreateRuntime(this.getFallbackAdapter(providerId), provider)(modelId);
    }

    hasProvider(name: ProviderName): boolean {
        return Boolean(findProvider(name)?.isAvailable());
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
        if (!provider?.isAvailable()) {
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
