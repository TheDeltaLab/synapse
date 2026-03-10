import { NextRequest, NextResponse } from 'next/server';

// Gateway URL - use environment variable at runtime, not build time
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

/**
 * Proxy all /api/admin/* requests to the gateway's /admin/* endpoints.
 * This allows the dashboard to communicate with the gateway without CORS issues
 * and without exposing the gateway URL to the browser.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const pathStr = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${GATEWAY_URL}/admin/${pathStr}${searchParams ? `?${searchParams}` : ''}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const pathStr = path.join('/');
    const url = `${GATEWAY_URL}/admin/${pathStr}`;

    try {
        const body = await request.json();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const pathStr = path.join('/');
    const url = `${GATEWAY_URL}/admin/${pathStr}`;

    try {
        const body = await request.json();
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const pathStr = path.join('/');
    const url = `${GATEWAY_URL}/admin/${pathStr}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 }
        );
    }
}
