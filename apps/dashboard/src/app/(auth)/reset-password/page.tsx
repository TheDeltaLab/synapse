import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth';
import { getSession } from '@/lib/auth';

export default async function ResetPasswordPage() {
    const session = await getSession();

    // If not logged in, redirect to login
    if (!session) {
        redirect('/login');
    }

    const isForced = session.status === 'PENDING_PASSWORD_RESET';

    return (
        <div className="space-y-4">
            <div className="text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {isForced ? 'Set New Password' : 'Change Password'}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {isForced
                        ? 'Please set a new password to continue'
                        : 'Update your account password'}
                </p>
            </div>

            <ResetPasswordForm isForced={isForced} />
        </div>
    );
}
