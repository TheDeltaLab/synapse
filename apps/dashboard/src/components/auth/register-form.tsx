'use client';

import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const passwordChecks = useMemo(() => ({
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        matches: password === confirmPassword && password.length > 0,
    }), [password, confirmPassword]);

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
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            router.push('/analytics');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
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

            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                />
                {password.length > 0 && (
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
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
                disabled={isLoading || !isPasswordValid || !passwordChecks.matches}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                    </>
                ) : (
                    'Create Admin Account'
                )}
            </Button>
        </form>
    );
}
