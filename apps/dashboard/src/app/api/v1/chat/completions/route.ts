import { NextRequest } from 'next/server';
import { proxyToGateway } from '@/lib/gateway-proxy';

export async function POST(request: NextRequest) {
    return proxyToGateway(request, '/v1/chat/completions', { streaming: true });
}
