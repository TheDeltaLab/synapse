import { NextRequest } from 'next/server';

// Gateway URL - use environment variable at runtime, not build time
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

/**
 * Proxy embedding requests to the gateway.
 */
export async function POST(request: NextRequest) {
    const url = `${GATEWAY_URL}/v1/embeddings`;

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

        const data = await response.json();
        return Response.json(data, { status: response.status });
    } catch (error) {
        console.error('Gateway embedding proxy error:', error);
        return Response.json(
            { error: 'Failed to connect to gateway' },
            { status: 502 },
        );
    }
}
