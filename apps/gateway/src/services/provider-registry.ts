import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { providerConfig, type ProviderName } from '../config/providers.js';
import type { LanguageModelV1 } from 'ai';

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
    }

    getProvider(name: ProviderName): any | undefined {
        return this.providers.get(name);
    }

    getModel(provider: ProviderName, modelId: string): LanguageModelV1 {
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
