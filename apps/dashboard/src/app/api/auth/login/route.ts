import { NextResponse } from 'next/server';

import { loginRequestSchema } from '@synapse/shared';

import { login, getAuthCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        // Parse and validate request body
        const body = await request.json();
        const result = loginRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: result.error.flatten() },
                { status: 400 },
            );
        }

        // Login
        const { user, token } = await login(result.data.email, result.data.password);

        // Create response with cookie
        const response = NextResponse.json({ user, message: 'Login successful' });
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
        console.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Login failed';
        return NextResponse.json({ error: message }, { status: 401 });
    }
}
