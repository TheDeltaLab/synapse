'use client';

import { useState } from 'react';
import { ApiKeyInput } from './api-key-input';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { SettingsPanel } from './settings-panel';
import { useChat } from '@/hooks/use-chat';

export function ChatInterface() {
    const [apiKey, setApiKey] = useState('');
    const { messages, isLoading, error, settings, sendMessage, clearMessages, updateSettings } = useChat();
    const hasModelSelection = Boolean(settings.modelSelection.provider && settings.modelSelection.model);

    let inputPlaceholder = 'Type a message...';
    if (!apiKey.trim()) {
        inputPlaceholder = 'Enter an API key to start...';
    } else if (!hasModelSelection) {
        inputPlaceholder = 'Select an available model to start...';
    }

    const handleSend = (content: string) => {
        if (!apiKey.trim() || !hasModelSelection) {
            return;
        }
        sendMessage(content, apiKey);
    };

    return (
        <div className="flex h-full">
            {/* Settings Sidebar */}
            <div className="w-80 border-r bg-card p-4 overflow-y-auto">
                <div className="space-y-6">
                    <ApiKeyInput apiKey={apiKey} onApiKeyChange={setApiKey} />
                    <SettingsPanel
                        settings={settings}
                        onSettingsChange={updateSettings}
                        onClear={clearMessages}
                        hasMessages={messages.length > 0}
                    />
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex flex-1 flex-col">
                <MessageList messages={messages} isLoading={isLoading} />
                {error && (
                    <div className="border-t border-destructive bg-destructive/10 px-4 py-2">
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}
                <MessageInput
                    onSend={handleSend}
                    disabled={isLoading || !apiKey.trim() || !hasModelSelection}
                    placeholder={inputPlaceholder}
                />
            </div>
        </div>
    );
}
