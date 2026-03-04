'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApiKeyCreatedResponse } from '@synapse/shared';
import { CreateKeyForm } from '@/components/api-keys/create-key-form';
import { KeyCreatedDialog } from '@/components/api-keys/key-created-dialog';
import { Header } from '@/components/layout/header';
import { gateway } from '@/lib/gateway';

export default function NewApiKeyPage() {
    const router = useRouter();
    const [createdKey, setCreatedKey] = useState<ApiKeyCreatedResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (data: { name: string; rateLimit: number }) => {
        setIsLoading(true);
        try {
            const key = await gateway.createApiKey(data);
            setCreatedKey(key);
        } catch (error) {
            console.error('Failed to create API key:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setCreatedKey(null);
        router.push('/api-keys');
    };

    return (
        <div className="flex h-full flex-col">
            <Header
                title="Create API Key"
                description="Create a new API key for accessing the gateway"
            />

            <div className="flex-1 p-6">
                <div className="mx-auto max-w-lg">
                    <CreateKeyForm onSubmit={handleCreate} isLoading={isLoading} />
                </div>
            </div>

            <KeyCreatedDialog
                apiKey={createdKey}
                open={!!createdKey}
                onClose={handleClose}
            />
        </div>
    );
}
