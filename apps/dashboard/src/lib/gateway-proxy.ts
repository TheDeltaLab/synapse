import { NextRequest } from 'next/server';

// Gateway URL - use environment variable at runtime, not build time
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

/**
 * Build proxy headers by forwarding Authorization and all x-synapse-* headers.
 */
function buildProxyHeaders(request: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    // Forward all x-synapse-* headers generically
    request.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-synapse-')) {
            headers[key] = value;
        }
    });

    return headers;
}

/**
 * Proxy a POST request to the gateway, with optional SSE streaming support.
 */
export async function proxyToGateway(
    request: NextRequest,
    path: string,
    options?: { streaming?: boolean },
): Promise<Response> {
    const url = `${GATEWAY_URL}${path}`;

    try {
        const body = await request.json();
        const headers = buildProxyHeaders(request);

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (options?.streaming && body.stream && response.body) {
            return new Response(response.body, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        console.error(`Gateway proxy error (${path}):`, error);
        return Response.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 },
        );
    }
}
