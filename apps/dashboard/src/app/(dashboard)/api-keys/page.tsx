'use client';

import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiKeyResponse } from '@synapse/shared';
import { KeyTable } from '@/components/api-keys/key-table';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { gateway } from '@/lib/gateway';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const response = await gateway.listApiKeys();
            setKeys(response.data);
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    return (
        <div className="flex h-full flex-col">
            <Header
                title="API Keys"
                description="Manage your API keys for accessing the gateway"
            >
                <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchKeys}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Link href="/api-keys/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Key
                    </Button>
                </Link>
            </Header>

            <div className="flex-1 p-6">
                <KeyTable keys={keys} onRefresh={fetchKeys} loading={loading} />
            </div>
        </div>
    );
}
