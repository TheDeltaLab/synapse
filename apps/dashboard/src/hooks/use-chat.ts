'use client';

import { useState, useCallback } from 'react';
import type { ModelSelection } from '@/components/playground/model-selector';
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from '@/lib/constants';
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
}

// Default provider when none is configured
const DEFAULT_PROVIDER = 'openai';

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<ChatSettings>({
        modelSelection: { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL },
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
    });

    const sendMessage = useCallback(async (content: string, apiKey: string) => {
        if (!content.trim() || !apiKey.trim()) return;

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
            // Remove the empty assistant message on error
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
