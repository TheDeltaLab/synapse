import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth';
import { isRegistrationOpen } from '@/lib/auth';

// Force dynamic rendering since we need to check the database
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
    const registrationOpen = await isRegistrationOpen();

    // If admin already exists, redirect to login
    if (!registrationOpen) {
        redirect('/login');
    }

    return (
        <div className="space-y-4">
            <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Create Admin Account</h1>
                <p className="text-sm text-muted-foreground">
                    Set up your administrator account to get started
                </p>
            </div>

            <RegisterForm />

            <p className="text-center text-sm text-muted-foreground">
                Already have an account?
                {' '}
                <Link href="/login" className="text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
