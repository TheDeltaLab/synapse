import { NextResponse } from 'next/server';

import { isRegistrationOpen } from '@/lib/auth';

export async function GET() {
    try {
        const isOpen = await isRegistrationOpen();
        return NextResponse.json({ isOpen });
    } catch (error) {
        console.error('Registration status error:', error);
        return NextResponse.json(
            { error: 'Failed to check registration status' },
            { status: 500 },
        );
    }
}
