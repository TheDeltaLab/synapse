import { redirect } from 'next/navigation';

import { Header } from '@/components/layout/header';
import { CreateStaffDialog } from '@/components/users/create-staff-dialog';
import { UsersTable } from '@/components/users/users-table';
import { getSession, getUsers } from '@/lib/auth';

// Force dynamic rendering since we need to check the session and database
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    if (session.role !== 'ADMIN') {
        redirect('/analytics');
    }

    const users = await getUsers();

    return (
        <>
            <Header
                title="Users"
                description="Manage dashboard users and staff accounts"
            >
                <CreateStaffDialog />
            </Header>
            <div className="flex-1 p-6">
                <UsersTable users={users} />
            </div>
        </>
    );
}
