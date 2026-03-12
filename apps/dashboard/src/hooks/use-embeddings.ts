'use client';

import { useState, useCallback } from 'react';
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

// Default embedding model and provider
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_PROVIDER = 'openai';

export function useEmbeddings() {
    const [result, setResult] = useState<EmbeddingResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const [settings, setSettings] = useState<EmbeddingSettings>({
        modelSelection: { provider: DEFAULT_EMBEDDING_PROVIDER, model: DEFAULT_EMBEDDING_MODEL },
        dimensions: null,
        encodingFormat: 'float',
    });

    const sendEmbedding = useCallback(async (input: string, apiKey: string) => {
        if (!input.trim() || !apiKey.trim()) return;

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
