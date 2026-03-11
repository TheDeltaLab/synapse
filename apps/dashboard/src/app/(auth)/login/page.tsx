import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth';
import { isRegistrationOpen } from '@/lib/auth';

// Force dynamic rendering since we need to check the database
export const dynamic = 'force-dynamic';

interface LoginPageProps {
    searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const { from } = await searchParams;
    const registrationOpen = await isRegistrationOpen();

    // If no admin exists, redirect to register
    if (registrationOpen) {
        redirect('/register');
    }

    return (
        <div className="space-y-4">
            <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                    Sign in to your account to continue
                </p>
            </div>

            <LoginForm redirectTo={from || '/analytics'} />

            {registrationOpen && (
                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?
                    {' '}
                    <Link href="/register" className="text-primary hover:underline">
                        Register
                    </Link>
                </p>
            )}
        </div>
    );
}
