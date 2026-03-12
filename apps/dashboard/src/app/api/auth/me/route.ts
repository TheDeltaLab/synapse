import { NextResponse } from 'next/server';

import { getSession, getUserById } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 },
            );
        }

        // Get fresh user data from database
        const user = await getUserById(session.id);

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 401 },
            );
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Get me error:', error);
        return NextResponse.json(
            { error: 'Failed to get user' },
            { status: 500 },
        );
    }
}
