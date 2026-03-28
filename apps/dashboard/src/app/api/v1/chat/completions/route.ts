import { NextRequest } from 'next/server';

// Gateway URL - use environment variable at runtime, not build time
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

/**
 * Proxy chat completion requests to the gateway.
 * This streams the response back to the client.
 */
export async function POST(request: NextRequest) {
    const url = `${GATEWAY_URL}/v1/chat/completions`;

    try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        // Forward x-synapse-* headers
        const providerHeader = request.headers.get('x-synapse-provider');
        if (providerHeader) {
            headers['x-synapse-provider'] = providerHeader;
        }

        const cacheHeader = request.headers.get('x-synapse-cache');
        if (cacheHeader) {
            headers['x-synapse-cache'] = cacheHeader;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        // For streaming responses, return the stream directly
        if (body.stream && response.body) {
            return new Response(response.body, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // For non-streaming, return JSON
        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway proxy error:', error);
        return Response.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 },
        );
    }
}
