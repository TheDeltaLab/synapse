'use client';

import { Header } from '@/components/layout/header';
import { EmbeddingInterface } from '@/components/playground/embedding-interface';

export default function EmbeddingPlaygroundPage() {
    return (
        <div className="flex h-full flex-col">
            <Header
                title="Embedding Playground"
                description="Test the gateway embedding API"
            />

            <div className="flex-1 overflow-hidden">
                <EmbeddingInterface />
            </div>
        </div>
    );
}
