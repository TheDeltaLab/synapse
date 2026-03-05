'use client';

import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/playground/chat-interface';

export default function PlaygroundPage() {
    return (
        <div className="flex h-full flex-col">
            <Header
                title="Playground"
                description="Test the gateway with interactive chat"
            />

            <div className="flex-1 overflow-hidden">
                <ChatInterface />
            </div>
        </div>
    );
}
