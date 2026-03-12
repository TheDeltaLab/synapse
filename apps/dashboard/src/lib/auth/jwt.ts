import * as jose from 'jose';
import { cookies } from 'next/headers';

import type { UserRole, UserStatus } from '@synapse/shared';

const COOKIE_NAME = 'synapse_auth';
const TOKEN_EXPIRY = '7d';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface JWTPayload {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
}

export interface SessionUser extends JWTPayload {
    iat: number;
    exp: number;
}

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT token with user payload
 */
export async function signToken(payload: JWTPayload): Promise<string> {
    const secret = getSecret();
    const token = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(secret);
    return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<SessionUser | null> {
    try {
        const secret = getSecret();
        const { payload } = await jose.jwtVerify(token, secret);
        return payload as unknown as SessionUser;
    } catch {
        return null;
    }
}

/**
 * Verify token synchronously for middleware (edge runtime)
 * Note: This is a workaround since middleware needs sync verification
 */
export function verifyTokenSync(token: string): SessionUser | null {
    try {
        // Decode without verification for basic checks
        // Full verification happens in API routes
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(
            Buffer.from(parts[1]!, 'base64url').toString('utf-8'),
        ) as SessionUser;

        // Check expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Get the current session from the auth cookie
 */
export async function getSession(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    return verifyToken(token);
}

/**
 * Get cookie options for setting auth cookie
 */
export function getAuthCookieOptions() {
    return {
        name: COOKIE_NAME,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    };
}

/**
 * Get the cookie name for middleware use
 */
export function getAuthCookieName(): string {
    return COOKIE_NAME;
}

/**
 * Clear the auth cookie (for use in server actions)
 */
export async function clearAuthCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
