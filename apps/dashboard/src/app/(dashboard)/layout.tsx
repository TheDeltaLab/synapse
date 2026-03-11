import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    // If not authenticated, redirect to login
    if (!session) {
        redirect('/login');
    }

    // If user has PENDING_PASSWORD_RESET status, redirect to reset password
    if (session.status === 'PENDING_PASSWORD_RESET') {
        redirect('/reset-password');
    }

    return (
        <div className="flex h-screen">
            <Sidebar user={session} />
            <main className="flex-1 overflow-auto bg-background">
                {children}
            </main>
        </div>
    );
}
