import { NextResponse } from 'next/server';

import { registerRequestSchema } from '@synapse/shared';

import { registerAdmin, isRegistrationOpen, getAuthCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        // Check if registration is open
        const isOpen = await isRegistrationOpen();
        if (!isOpen) {
            return NextResponse.json(
                { error: 'Registration is closed' },
                { status: 403 },
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const result = registerRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: result.error.flatten() },
                { status: 400 },
            );
        }

        // Register admin
        const { user, token } = await registerAdmin(result.data);

        // Create response with cookie
        const response = NextResponse.json(
            { user, message: 'Admin account created successfully' },
            { status: 201 },
        );
        const cookieOptions = getAuthCookieOptions();
        response.cookies.set(cookieOptions.name, token, {
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            maxAge: cookieOptions.maxAge,
            path: cookieOptions.path,
        });

        return response;
    } catch (error) {
        console.error('Registration error:', error);
        const message = error instanceof Error ? error.message : 'Registration failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
