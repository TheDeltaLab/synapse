'use client';

import { useEffect, useState } from 'react';
import type { ModelSelection } from '@/components/playground/model-selector';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { gateway } from '@/lib/gateway';

interface EmbeddingProviderInfo {
    id: string;
    name: string;
    available: boolean;
    chatModels: string[];
    defaultChatModel?: string;
    embeddingModels: string[];
    defaultEmbeddingModel: string | null;
}

interface EmbeddingModelSelectorProps {
    value: ModelSelection;
    onChange: (value: ModelSelection) => void;
}

// Create a combined value for the select (provider:model)
function toSelectValue(selection: ModelSelection): string {
    return `${selection.provider}:${selection.model}`;
}

// Parse the combined value back to provider and model
function fromSelectValue(value: string): ModelSelection {
    const [provider = '', ...modelParts] = value.split(':');
    return { provider, model: modelParts.join(':') };
}

export function EmbeddingModelSelector({ value, onChange }: EmbeddingModelSelectorProps) {
    const [providers, setProviders] = useState<EmbeddingProviderInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProviders() {
            try {
                setLoading(true);
                const response = await gateway.getEmbeddingProviders();
                // Only show available providers
                setProviders(response.providers.filter(p => p.available));
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch embedding providers');
            } finally {
                setLoading(false);
            }
        }

        fetchProviders();
    }, []);

    const handleValueChange = (selectValue: string) => {
        onChange(fromSelectValue(selectValue));
    };

    if (loading) {
        return (
            <Select disabled>
                <SelectTrigger>
                    <SelectValue placeholder="Loading models..." />
                </SelectTrigger>
            </Select>
        );
    }

    if (error) {
        return (
            <div className="space-y-1">
                <Select disabled>
                    <SelectTrigger>
                        <SelectValue placeholder="Error loading models" />
                    </SelectTrigger>
                </Select>
                <p className="text-xs text-destructive">{error}</p>
            </div>
        );
    }

    if (providers.length === 0) {
        return (
            <div className="space-y-1">
                <Select disabled>
                    <SelectTrigger>
                        <SelectValue placeholder="No models available" />
                    </SelectTrigger>
                </Select>
                <p className="text-xs text-muted-foreground">
                    No embedding providers configured. Add API keys in the gateway .env file.
                </p>
            </div>
        );
    }

    return (
        <Select value={toSelectValue(value)} onValueChange={handleValueChange}>
            <SelectTrigger>
                <SelectValue placeholder="Select an embedding model" />
            </SelectTrigger>
            <SelectContent>
                {providers.map(provider => (
                    <SelectGroup key={provider.id}>
                        <SelectLabel>{provider.name}</SelectLabel>
                        {provider.embeddingModels.map(model => (
                            <SelectItem key={`${provider.id}:${model}`} value={`${provider.id}:${model}`}>
                                {model}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}
