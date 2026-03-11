import { NextResponse } from 'next/server';

import { resetPasswordRequestSchema } from '@synapse/shared';

import { getSession, resetPassword, forceResetPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 },
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const result = resetPasswordRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: result.error.flatten() },
                { status: 400 },
            );
        }

        const { currentPassword, newPassword } = result.data;

        // If user is in PENDING_PASSWORD_RESET status, use forceResetPassword
        if (session.status === 'PENDING_PASSWORD_RESET') {
            await forceResetPassword(session.id, newPassword);
        } else {
            // Normal password reset requires current password
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Current password is required' },
                    { status: 400 },
                );
            }
            await resetPassword(session.id, currentPassword, newPassword);
        }

        return NextResponse.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        const message = error instanceof Error ? error.message : 'Password reset failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
