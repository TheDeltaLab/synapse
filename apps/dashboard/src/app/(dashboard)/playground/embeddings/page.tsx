'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { EmbeddingInterface } from '@/components/playground/embedding-interface';
import { Button } from '@/components/ui/button';

export default function EmbeddingPlaygroundPage() {
    return (
        <div className="flex h-full flex-col">
            <Header
                title="Embedding Playground"
                description="Test the gateway embedding API"
            >
                <Button variant="outline" size="sm" asChild>
                    <Link href="/playground">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Chat Playground
                    </Link>
                </Button>
            </Header>

            <div className="flex-1 overflow-hidden">
                <EmbeddingInterface />
            </div>
        </div>
    );
}
