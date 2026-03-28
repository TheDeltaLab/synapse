'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { ProviderInfo } from '@synapse/shared';
import type { ModelSelection } from '@/components/playground/model-selector';
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from '@/lib/constants';
import { gateway } from '@/lib/gateway';

export type Message = UIMessage;

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

export function usePlaygroundChat(apiKey: string) {
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

    // Use a ref so the transport body closure always reads the latest values
    const bodyRef = useRef({
        apiKey,
        model: settings.modelSelection.model,
        provider: settings.modelSelection.provider,
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        cacheEnabled: settings.cacheEnabled,
    });
    bodyRef.current = {
        apiKey,
        model: settings.modelSelection.model,
        provider: settings.modelSelection.provider,
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        cacheEnabled: settings.cacheEnabled,
    };

    const [transport] = useState(() => new DefaultChatTransport({
        api: '/api/chat',
        body: () => bodyRef.current,
    }));

    const {
        messages,
        sendMessage: aiSendMessage,
        setMessages,
        status,
        error: aiError,
    } = useChat({ transport });

    const isLoading = status === 'submitted' || status === 'streaming';
    const error = aiError ? aiError.message : null;

    const sendMessage = useCallback((content: string) => {
        if (!content.trim() || !apiKey.trim()) return;
        if (!settings.modelSelection.provider || !settings.modelSelection.model) return;
        aiSendMessage({ text: content.trim() });
    }, [apiKey, settings.modelSelection, aiSendMessage]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, [setMessages]);

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
