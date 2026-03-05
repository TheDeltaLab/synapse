import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { customProvider, type LanguageModel } from 'ai';
import { providerConfig, type ProviderName } from '../config/providers.js';

type LanguageModelV3 = Extract<LanguageModel, { specificationVersion: 'v3' }>;

/**
 * Custom fetch wrapper that normalizes OpenRouter streaming responses.
 * Fixes missing `index` field in chunks, which causes Zod validation errors in AI SDK.
 */
function createNormalizingFetch(originalFetch: typeof fetch = fetch): typeof fetch {
    return async (url, init) => {
        const response = await originalFetch(url, init);

        // Only intercept streaming responses
        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
            return response;
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Process the stream in the background
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
                                const jsonStr = line.slice(6); // Remove 'data: ' prefix
                                const data = JSON.parse(jsonStr);

                                // Fix missing index in choices array
                                if (data.choices && Array.isArray(data.choices)) {
                                    data.choices = data.choices.map((choice: any, idx: number) => ({
                                        index: idx,
                                        ...choice,
                                    }));
                                }

                                // Re-serialize and send
                                await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                            } catch {
                                // If JSON parsing fails, pass through as-is
                                await writer.write(encoder.encode(line + '\n'));
                            }
                        } else {
                            // Pass through non-data lines
                            await writer.write(encoder.encode(line + '\n'));
                        }
                    }
                }

                // Handle any remaining buffer
                if (buffer) {
                    await writer.write(encoder.encode(buffer));
                }
            } catch (error) {
                console.error('[NormalizingFetch] Stream processing error:', error);
            } finally {
                await writer.close();
            }
        })();

        // Return a new response with the transformed stream
        return new Response(readable, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    };
}

const openai = createOpenAI({
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY!,
    baseURL: process.env.OPENAI_COMPATIBLE_API_BASE_URL!,
    fetch: createNormalizingFetch(),
});

const openrouter = createOpenRouter({
  apiKey: 'YOUR_OPENROUTER_API_KEY',
});

const deepseek = createDeepSeek({
    apiKey: process.env.DEEP_SEEK_API_KEY!
});

export type ModelProvider = ReturnType<typeof customProvider>;

export const languageModels: Record<string, LanguageModelV3> = {
    'chat-model': openai.chat('gpt-5-mini'),
    'text-model': deepseek.chat('deepseek-chat'),
};

export type SynapseModel = keyof typeof languageModels;

export const modelProvider: ModelProvider = customProvider(
    {
        languageModels,
    },
);

export class ProviderRegistry {
    private providers: Map<ProviderName, any> = new Map();

    constructor() {
        this.registerProviders();
    }

    private registerProviders() {
        // Register OpenAI
        if (providerConfig.openai.apiKey) {
            const openai = createOpenAI({
                apiKey: providerConfig.openai.apiKey,
            });
            this.providers.set('openai', openai);
        }

        // Register Anthropic
        if (providerConfig.anthropic.apiKey) {
            const anthropic = createAnthropic({
                apiKey: providerConfig.anthropic.apiKey,
            });
            this.providers.set('anthropic', anthropic);
        }

        // Register Google
        if (providerConfig.google.apiKey) {
            const google = createGoogleGenerativeAI({
                apiKey: providerConfig.google.apiKey,
            });
            this.providers.set('google', google);
        }

        // Register OpenRouter
        if (providerConfig.openrouter.apiKey) {
            const openrouter = createOpenRouter({
                apiKey: providerConfig.openrouter.apiKey,
            });
            this.providers.set('openrouter', openrouter);
        }
    }

    getProvider(name: ProviderName): any | undefined {
        return this.providers.get(name);
    }

    getModel(provider: ProviderName, modelId: string): LanguageModelV3 {
        const providerInstance = this.getProvider(provider);
        if (!providerInstance) {
            throw new Error(`Provider ${provider} not found or not configured`);
        }

        return providerInstance(modelId);
    }

    hasProvider(name: ProviderName): boolean {
        return this.providers.has(name);
    }

    getAvailableProviders(): ProviderName[] {
        return Array.from(this.providers.keys());
    }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
