'use client';

import { Binary } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/playground/chat-interface';
import { Button } from '@/components/ui/button';

export default function PlaygroundPage() {
    return (
        <div className="flex h-full flex-col">
            <Header
                title="Playground"
                description="Test the gateway with interactive chat"
            >
                <Button variant="outline" size="sm" asChild>
                    <Link href="/playground/embeddings">
                        <Binary className="mr-2 h-4 w-4" />
                        Embedding Playground
                    </Link>
                </Button>
            </Header>

            <div className="flex-1 overflow-hidden">
                <ChatInterface />
            </div>
        </div>
    );
}
