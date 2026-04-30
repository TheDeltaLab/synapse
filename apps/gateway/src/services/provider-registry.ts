import {
    getProvider as findProvider,
    getDeployment,
    getEmbeddingDeployments,
    getDefaultEmbeddingModel as getConfiguredDefaultEmbeddingModel,
    findDeploymentByModel,
    getAvailableProviders as getConfiguredAvailableProviders,
    hasEmbeddingSupport as configuredHasEmbeddingSupport,
    getAvailableEmbeddingProviders as configuredGetAvailableEmbeddingProviders,
    type Deployment,
    type ProviderName,
    type ModelTask,
} from '../config/providers.js';

function warnIfDeprecated(deployment: Deployment | null): void {
    if (deployment?.deprecated) {
        console.warn(
            `[deprecation] Model "${deployment.modelId}" (provider: ${deployment.providerId}) is scheduled for removal. Please migrate to a supported model.`,
        );
    }
}

export interface ResolvedEndpoint {
    url: string;
    headers: Record<string, string>;
    deployment: Deployment | null;
    providerId: string;
}

export class ProviderRegistry {
    static readonly DEFAULT_PROVIDER_ID = 'openai';

    resolveEndpoint(
        requestPath: string,
        modelId?: string,
        task?: ModelTask,
        providerId?: string,
    ): ResolvedEndpoint {
        // When both model and provider are missing, default to OpenAI
        const effectiveProviderId = providerId ?? (modelId ? undefined : ProviderRegistry.DEFAULT_PROVIDER_ID);

        if (effectiveProviderId) {
            const provider = findProvider(effectiveProviderId);

            if (!provider?.isAvailable()) {
                throw new Error(`Provider ${effectiveProviderId} not found or not configured`);
            }

            // Look up deployment only when modelId is provided
            const deployment = modelId
                ? task !== undefined
                    ? getDeployment(effectiveProviderId, modelId, task) ?? null
                    : findDeploymentByModel(modelId) ?? null
                : null;

            warnIfDeprecated(deployment);

            return {
                url: provider.baseUrl + requestPath,
                headers: {
                    ...provider.getAuthHeaders(),
                },
                deployment,
                providerId: effectiveProviderId,
            };
        }

        // No provider specified — model-based routing
        // TODO: findDeploymentByModel searches across all providers; if multiple providers
        // share a model name, this could attach a deployment from the wrong provider.
        // Consider restricting the lookup to the selected provider.
        const deployment = findDeploymentByModel(modelId!, task);
        if (deployment) {
            const provider = findProvider(deployment.providerId);
            if (!provider?.isAvailable()) {
                throw new Error(`Provider ${deployment.providerId} not found or not configured`);
            }

            warnIfDeprecated(deployment);

            return {
                url: provider.baseUrl + requestPath,
                headers: {
                    ...provider.getAuthHeaders(),
                },
                deployment,
                providerId: deployment.providerId,
            };
        }

        throw new Error(`No deployment found for model ${modelId}${task ? ` (task: ${task})` : ''}`);
    }

    hasProvider(name: ProviderName): boolean {
        return Boolean(findProvider(name)?.isAvailable());
    }

    getAvailableProviders(): ProviderName[] {
        return getConfiguredAvailableProviders();
    }

    hasEmbeddingSupport(providerId: ProviderName): boolean {
        return configuredHasEmbeddingSupport(providerId);
    }

    getAvailableEmbeddingProviders(): ProviderName[] {
        return configuredGetAvailableEmbeddingProviders();
    }

    getEmbeddingModels(providerId: ProviderName): readonly string[] {
        return getEmbeddingDeployments(providerId).map(deployment => deployment.modelId);
    }

    getDefaultEmbeddingModel(providerId: ProviderName): string | null {
        return getConfiguredDefaultEmbeddingModel(providerId);
    }
}

export const providerRegistry = new ProviderRegistry();
