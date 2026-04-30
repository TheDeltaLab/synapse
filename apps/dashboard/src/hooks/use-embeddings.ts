'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ProviderInfo } from '@synapse/shared';
import type { ModelSelection } from '@/components/playground/model-selector';
import { gateway } from '@/lib/gateway';

export interface EmbeddingResult {
    embeddings: number[][];
    usage: {
        tokens: number;
    };
}

export interface EmbeddingSettings {
    modelSelection: ModelSelection;
    dimensions: number | null;
    cacheEnabled: boolean;
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
        cacheEnabled: true,
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

    const sendEmbedding = useCallback(async (input: string | string[], apiKey: string) => {
        const inputs = Array.isArray(input) ? input.filter(s => s.trim().length > 0) : [];
        const isBatch = Array.isArray(input);
        const hasContent = isBatch ? inputs.length > 0 : input.trim().length > 0;
        if (!hasContent || !apiKey.trim()) return;

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
            const response = await fetch('/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: isBatch ? inputs : (input as string).trim(),
                    model: settings.modelSelection.model,
                    provider: settings.modelSelection.provider,
                    dimensions: settings.dimensions,
                    apiKey,
                    cacheEnabled: settings.cacheEnabled,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Failed to generate embedding');
            }

            const raw = await response.json();
            const embeddings: number[][] = Array.isArray(raw.embeddings)
                ? raw.embeddings
                : [raw.embedding];
            const elapsed = Math.round(performance.now() - startTime);
            setLatency(elapsed);
            setResult({
                embeddings,
                usage: { tokens: raw.usage?.tokens ?? 0 },
            });
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
