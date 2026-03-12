import { NextResponse } from 'next/server';

import { createStaffRequestSchema } from '@synapse/shared';

import { getSession, getUsers, createStaffAccount } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 },
            );
        }

        if (session.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 },
            );
        }

        const users = await getUsers();
        return NextResponse.json({ users });
    } catch (error) {
        console.error('Get staff error:', error);
        return NextResponse.json(
            { error: 'Failed to get users' },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 },
            );
        }

        if (session.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 },
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const result = createStaffRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: result.error.flatten() },
                { status: 400 },
            );
        }

        // Create staff account
        const { user, temporaryPassword } = await createStaffAccount(
            result.data,
            session.id,
        );

        return NextResponse.json(
            { user, temporaryPassword },
            { status: 201 },
        );
    } catch (error) {
        console.error('Create staff error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create staff account';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
