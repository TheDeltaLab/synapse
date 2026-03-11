'use client';

import { AlertCircle, Copy, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateStaffFormProps {
    onSuccess?: () => void;
}

export function CreateStaffForm({ onSuccess }: CreateStaffFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create staff account');
            }

            setTemporaryPassword(data.temporaryPassword);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create staff account');
        } finally {
            setIsLoading(false);
        }
    }

    async function copyPassword() {
        if (temporaryPassword) {
            await navigator.clipboard.writeText(temporaryPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function handleReset() {
        setName('');
        setEmail('');
        setTemporaryPassword(null);
        setError(null);
    }

    if (temporaryPassword) {
        return (
            <div className="space-y-4">
                <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                    <h3 className="font-medium text-green-800 dark:text-green-200">
                        Staff account created!
                    </h3>
                    <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                        Share this temporary password with the user. They will be required to change it on first login.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Temporary Password</Label>
                    <div className="flex gap-2">
                        <Input
                            value={temporaryPassword}
                            readOnly
                            className="font-mono"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={copyPassword}
                        >
                            {copied ? (
                                <Check className="h-4 w-4 text-green-500" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleReset}
                >
                    Create Another
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="staffName">Name</Label>
                <Input
                    id="staffName"
                    type="text"
                    placeholder="Staff member's name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    disabled={isLoading}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                    id="staffEmail"
                    type="email"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                    </>
                ) : (
                    'Create Staff Account'
                )}
            </Button>
        </form>
    );
}
