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
export type ResponseStyle = 'openai' | 'anthropic' | 'google';

export interface ChatSettings {
    modelSelection: ModelSelection;
    responseStyle: ResponseStyle | '';
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

function getDefaultStyleFor(providers: ProviderInfo[], providerId: string): ResponseStyle | '' {
    return providers.find(p => p.id === providerId)?.defaultResponseStyle ?? '';
}

export function usePlaygroundChat(apiKey: string) {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [settings, setSettings] = useState<ChatSettings>({
        modelSelection: { provider: '', model: '' },
        responseStyle: '',
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
                setProviders(availableProviders);

                setSettings((prev) => {
                    const selectionOk = isChatSelectionAvailable(availableProviders, prev.modelSelection);
                    const nextSelection = selectionOk
                        ? prev.modelSelection
                        : getDefaultChatSelection(availableProviders);

                    if (!nextSelection) {
                        return prev;
                    }

                    const providerInfo = availableProviders.find(p => p.id === nextSelection.provider);
                    const styleOk = providerInfo
                        && prev.responseStyle
                        && providerInfo.responseStyles.includes(prev.responseStyle as ResponseStyle);
                    const nextStyle: ResponseStyle | '' = styleOk
                        ? prev.responseStyle
                        : (providerInfo?.defaultResponseStyle ?? '');

                    if (selectionOk && nextStyle === prev.responseStyle) {
                        return prev;
                    }

                    return {
                        ...prev,
                        modelSelection: nextSelection,
                        responseStyle: nextStyle,
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
        responseStyle: settings.responseStyle,
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        cacheEnabled: settings.cacheEnabled,
    });
    bodyRef.current = {
        apiKey,
        model: settings.modelSelection.model,
        provider: settings.modelSelection.provider,
        responseStyle: settings.responseStyle,
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
        setSettings((prev) => {
            const merged = { ...prev, ...newSettings };
            // If provider changed and the merged style isn't valid for the new provider,
            // reset style to the new provider's default.
            if (newSettings.modelSelection && newSettings.modelSelection.provider !== prev.modelSelection.provider) {
                const providerInfo = providers.find(p => p.id === merged.modelSelection.provider);
                if (providerInfo && (!merged.responseStyle || !providerInfo.responseStyles.includes(merged.responseStyle as ResponseStyle))) {
                    merged.responseStyle = providerInfo.defaultResponseStyle;
                }
            }
            return merged;
        });
    }, [providers]);

    return {
        messages,
        isLoading,
        error,
        settings,
        providers,
        sendMessage,
        clearMessages,
        updateSettings,
        getDefaultStyleFor: (providerId: string) => getDefaultStyleFor(providers, providerId),
    };
}
