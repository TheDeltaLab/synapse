'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ProviderInfo } from '@synapse/shared';
import type { ModelSelection } from '@/components/playground/model-selector';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from '@/lib/constants';
import { gateway } from '@/lib/gateway';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatSettings {
    modelSelection: ModelSelection;
    temperature: number;
    maxTokens: number;
    cacheEnabled: boolean;
}

function isChatSelectionAvailable(providers: ProviderInfo[], selection: ModelSelection): boolean {
    return providers.some(provider => (
        provider.id === selection.provider
        && provider.chatModels.includes(selection.model)
    ));
}

function getDefaultChatSelection(providers: ProviderInfo[]): ModelSelection | null {
    const provider = providers.find(candidate => candidate.chatModels.length > 0);
    if (!provider) {
        return null;
    }

    const model = provider.defaultChatModel ?? provider.chatModels[0];
    if (!model) {
        return null;
    }

    return {
        provider: provider.id,
        model,
    };
}

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<ChatSettings>({
        modelSelection: { provider: '', model: '' },
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
        cacheEnabled: true,
    });

    useEffect(() => {
        let cancelled = false;

        async function syncModelSelection() {
            try {
                const response = await gateway.getProviders();
                if (cancelled) {
                    return;
                }

                const availableProviders = response.providers.filter(provider => (
                    provider.available && provider.chatModels.length > 0
                ));

                setSettings((prev) => {
                    if (isChatSelectionAvailable(availableProviders, prev.modelSelection)) {
                        return prev;
                    }

                    const nextSelection = getDefaultChatSelection(availableProviders);
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

    const sendMessage = useCallback(async (content: string, apiKey: string) => {
        if (!content.trim() || !apiKey.trim()) return;

        if (!settings.modelSelection.provider || !settings.modelSelection.model) {
            setError('Select an available model before sending');
            return;
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
        };

        setMessages(prev => [...prev, assistantMessage]);

        try {
            const allMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const stream = gateway.streamChatCompletion(apiKey, allMessages, {
                model: settings.modelSelection.model,
                provider: settings.modelSelection.provider,
                temperature: settings.temperature,
                maxTokens: settings.maxTokens,
                cacheEnabled: settings.cacheEnabled,
            });

            for await (const chunk of stream) {
                setMessages(prev =>
                    prev.map(m =>
                        m.id === assistantMessage.id
                            ? { ...m, content: m.content + chunk }
                            : m,
                    ),
                );
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
            setError(errorMessage);
            setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        } finally {
            setIsLoading(false);
        }
    }, [messages, settings]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setError(null);
    }, []);

    const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return {
        messages,
        isLoading,
        error,
        settings,
        sendMessage,
        clearMessages,
        updateSettings,
    };
}
