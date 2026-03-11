'use client';

import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ResetPasswordFormProps {
    isForced?: boolean;
}

export function ResetPasswordForm({ isForced = false }: ResetPasswordFormProps) {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const passwordChecks = useMemo(() => ({
        minLength: newPassword.length >= 8,
        hasUppercase: /[A-Z]/.test(newPassword),
        hasLowercase: /[a-z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
        matches: newPassword === confirmPassword && newPassword.length > 0,
    }), [newPassword, confirmPassword]);

    const isPasswordValid = passwordChecks.minLength
        && passwordChecks.hasUppercase
        && passwordChecks.hasLowercase
        && passwordChecks.hasNumber;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!isPasswordValid) {
            setError('Please ensure your password meets all requirements');
            return;
        }

        if (!passwordChecks.matches) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            const body: { newPassword: string; currentPassword?: string } = {
                newPassword,
            };

            if (!isForced) {
                body.currentPassword = currentPassword;
            }

            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Password reset failed');
            }

            router.push('/analytics');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
        } finally {
            setIsLoading(false);
        }
    }

    function CheckIcon({ valid }: { valid: boolean }) {
        return valid ? (
            <Check className="h-3 w-3 text-green-500" />
        ) : (
            <X className="h-3 w-3 text-muted-foreground" />
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

            {isForced && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    You must set a new password before continuing.
                </div>
            )}

            {!isForced && (
                <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        autoComplete="current-password"
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                    id="newPassword"
                    type="password"
                    placeholder="Create a new password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                />
                {newPassword.length > 0 && (
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                            <CheckIcon valid={passwordChecks.minLength} />
                            <span className={passwordChecks.minLength ? 'text-green-500' : 'text-muted-foreground'}>
                                At least 8 characters
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckIcon valid={passwordChecks.hasUppercase} />
                            <span className={passwordChecks.hasUppercase ? 'text-green-500' : 'text-muted-foreground'}>
                                One uppercase letter
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckIcon valid={passwordChecks.hasLowercase} />
                            <span className={passwordChecks.hasLowercase ? 'text-green-500' : 'text-muted-foreground'}>
                                One lowercase letter
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckIcon valid={passwordChecks.hasNumber} />
                            <span className={passwordChecks.hasNumber ? 'text-green-500' : 'text-muted-foreground'}>
                                One number
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                />
                {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                        <CheckIcon valid={passwordChecks.matches} />
                        <span className={passwordChecks.matches ? 'text-green-500' : 'text-muted-foreground'}>
                            Passwords match
                        </span>
                    </div>
                )}
            </div>

            <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isPasswordValid || !passwordChecks.matches || (!isForced && !currentPassword)}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating password...
                    </>
                ) : (
                    'Update Password'
                )}
            </Button>
        </form>
    );
}
