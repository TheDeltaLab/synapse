'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ProviderInfo } from '@synapse/shared';
import type { ModelSelection } from '@/components/playground/model-selector';
import { gateway } from '@/lib/gateway';

export interface EmbeddingResult {
    object: string;
    data: Array<{
        object: string;
        index: number;
        embedding: number[] | string;
    }>;
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

export interface EmbeddingSettings {
    modelSelection: ModelSelection;
    dimensions: number | null;
    encodingFormat: 'float' | 'base64';
}

function isEmbeddingSelectionAvailable(providers: ProviderInfo[], selection: ModelSelection): boolean {
    return providers.some(provider => (
        provider.id === selection.provider
        && provider.embeddingModels.includes(selection.model)
    ));
}

function getDefaultEmbeddingSelection(providers: ProviderInfo[]): ModelSelection | null {
    const provider = providers.find(candidate => candidate.embeddingModels.length > 0);
    if (!provider) {
        return null;
    }

    const model = provider.defaultEmbeddingModel ?? provider.embeddingModels[0];
    if (!model) {
        return null;
    }

    return {
        provider: provider.id,
        model,
    };
}

export function useEmbeddings() {
    const [result, setResult] = useState<EmbeddingResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [settings, setSettings] = useState<EmbeddingSettings>({
        modelSelection: { provider: '', model: '' },
        dimensions: null,
        encodingFormat: 'float',
    });

    useEffect(() => {
        let cancelled = false;

        async function syncModelSelection() {
            try {
                const response = await gateway.getEmbeddingProviders();
                if (cancelled) {
                    return;
                }

                const availableProviders = response.providers.filter(provider => (
                    provider.available && provider.embeddingModels.length > 0
                ));

                setSettings((prev) => {
                    if (isEmbeddingSelectionAvailable(availableProviders, prev.modelSelection)) {
                        return prev;
                    }

                    const nextSelection = getDefaultEmbeddingSelection(availableProviders);
                    if (!nextSelection) {
                        return prev;
                    }

                    return {
                        ...prev,
                        modelSelection: nextSelection,
                    };
                });
            } catch {
                return;
            }
        }

        syncModelSelection();

        return () => {
            cancelled = true;
        };
    }, []);

    const sendEmbedding = useCallback(async (input: string, apiKey: string) => {
        if (!input.trim() || !apiKey.trim()) return;

        if (!settings.modelSelection.provider || !settings.modelSelection.model) {
            setError('Select an available embedding model before generating');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);
        setLatency(null);

        const startTime = performance.now();

        try {
            const body: Record<string, unknown> = {
                model: settings.modelSelection.model,
                input: input.trim(),
                encoding_format: settings.encodingFormat,
            };

            if (settings.dimensions !== null) {
                body.dimensions = settings.dimensions;
            }

            const data = await gateway.createEmbedding(
                apiKey,
                body,
                settings.modelSelection.provider,
            );

            const elapsed = Math.round(performance.now() - startTime);
            setLatency(elapsed);
            setResult(data as EmbeddingResult);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate embedding';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [settings]);

    const clearResults = useCallback(() => {
        setResult(null);
        setError(null);
        setLatency(null);
    }, []);

    const updateSettings = useCallback((newSettings: Partial<EmbeddingSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return {
        result,
        isLoading,
        error,
        latency,
        settings,
        sendEmbedding,
        clearResults,
        updateSettings,
    };
}
