import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { verifyTokenSync, getAuthCookieName } from '@/lib/auth/jwt';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register'];

// Auth API routes that are always accessible (except staff which requires admin)
const publicApiRoutes = [
    '/api/auth/registration-status',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/logout',
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        return NextResponse.next();
    }

    // Allow public API routes
    if (publicApiRoutes.some(route => pathname === route)) {
        return NextResponse.next();
    }

    // Get auth token from cookie
    const token = request.cookies.get(getAuthCookieName())?.value;

    // Check if user is authenticated (using sync verification for middleware)
    const session = token ? verifyTokenSync(token) : null;

    // Handle API routes
    if (pathname.startsWith('/api/')) {
        if (!session) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 },
            );
        }
        return NextResponse.next();
    }

    // Handle page routes - redirect to login if not authenticated
    if (!session) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If user has PENDING_PASSWORD_RESET status, redirect to reset password
    // (except if already on reset-password page)
    if (session.status === 'PENDING_PASSWORD_RESET' && pathname !== '/reset-password') {
        return NextResponse.redirect(new URL('/reset-password', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
