'use client';

import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/playground/chat-interface';

export default function ChatPlaygroundPage() {
    return (
        <div className="flex h-full flex-col">
            <Header
                title="Chat Playground"
                description="Test the gateway with interactive chat"
            />

            <div className="flex-1 overflow-hidden">
                <ChatInterface />
            </div>
        </div>
    );
}
