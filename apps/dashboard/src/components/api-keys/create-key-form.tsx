'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateKeyFormProps {
    onSubmit: (data: { name: string; rateLimit: number }) => Promise<void>;
    isLoading: boolean;
}

export function CreateKeyForm({ onSubmit, isLoading }: CreateKeyFormProps) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [rateLimit, setRateLimit] = useState('1000');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        const rateLimitNum = parseInt(rateLimit, 10);
        if (isNaN(rateLimitNum) || rateLimitNum < 1) {
            setError('Rate limit must be a positive number');
            return;
        }

        try {
            await onSubmit({ name: name.trim(), rateLimit: rateLimitNum });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create API key');
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>New API Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g., Production API Key"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rateLimit">Rate Limit (requests/hour)</Label>
                        <Input
                            id="rateLimit"
                            type="number"
                            min="1"
                            value={rateLimit}
                            onChange={e => setRateLimit(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Key'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
