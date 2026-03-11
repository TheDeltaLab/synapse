import { NextResponse } from 'next/server';

import { getAuthCookieName } from '@/lib/auth';

export async function POST() {
    try {
        // Create response and clear the cookie
        const response = NextResponse.json({ message: 'Logged out successfully' });
        response.cookies.set(getAuthCookieName(), '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0, // Expire immediately
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 },
        );
    }
}
