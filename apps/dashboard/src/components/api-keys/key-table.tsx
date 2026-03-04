'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ApiKeyResponse } from '@synapse/shared';
import { DeleteDialog } from '@/components/api-keys/delete-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { gateway } from '@/lib/gateway';

interface KeyTableProps {
    keys: ApiKeyResponse[];
    onRefresh: () => void;
    loading: boolean;
}

export function KeyTable({ keys, onRefresh, loading }: KeyTableProps) {
    const { toast } = useToast();
    const [deleteKey, setDeleteKey] = useState<ApiKeyResponse | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const handleToggleEnabled = async (key: ApiKeyResponse) => {
        setTogglingId(key.id);
        try {
            await gateway.updateApiKey(key.id, { enabled: !key.enabled });
            toast({
                title: key.enabled ? 'Key disabled' : 'Key enabled',
                description: `API key "${key.name}" has been ${key.enabled ? 'disabled' : 'enabled'}.`,
            });
            onRefresh();
        } catch (_error) {
            toast({
                title: 'Error',
                description: 'Failed to update API key.',
                variant: 'destructive',
            });
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (key: ApiKeyResponse) => {
        try {
            await gateway.deleteApiKey(key.id);
            toast({
                title: 'Key deleted',
                description: `API key "${key.name}" has been deleted.`,
            });
            setDeleteKey(null);
            onRefresh();
        } catch (_error) {
            toast({
                title: 'Error',
                description: 'Failed to delete API key.',
                variant: 'destructive',
            });
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading && keys.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading API keys...</p>
                </CardContent>
            </Card>
        );
    }

    if (keys.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No API keys found.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create your first API key to get started.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-medium">Rate Limit</th>
                                <th className="px-4 py-3 text-left text-sm font-medium">Last Used</th>
                                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keys.map(key => (
                                <tr key={key.id} className="border-b last:border-0">
                                    <td className="px-4 py-3">
                                        <span className="font-medium">{key.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant={key.enabled ? 'success' : 'secondary'}>
                                            {key.enabled ? 'Active' : 'Disabled'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {key.rateLimit.toLocaleString()}
                                        {' '}
                                        req/hr
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {formatDate(key.lastUsedAt)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {formatDate(key.createdAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <Switch
                                                checked={key.enabled}
                                                onCheckedChange={() => handleToggleEnabled(key)}
                                                disabled={togglingId === key.id}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeleteKey(key)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <DeleteDialog
                apiKey={deleteKey}
                open={!!deleteKey}
                onClose={() => setDeleteKey(null)}
                onConfirm={() => deleteKey && handleDelete(deleteKey)}
            />
        </>
    );
}
