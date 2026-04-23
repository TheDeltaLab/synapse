import type { ProviderAdapter, ParsedResponse, ParsedRequest, ParsedEmbeddingResponse, TokenUsage, RouteMatch } from './types.js';
import { summarizeContent } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_PATHS = new Set([
    '/v1/chat/completions',
    '/v1/embeddings',
    '/v1/completions',
    '/v1/responses',
]);

export class OpenAIAdapter implements ProviderAdapter {
    readonly style = 'openai';

    matchRoute(method: string, path: string): RouteMatch | null {
        if (method !== 'POST') return null;
        if (!ALLOWED_PATHS.has(path)) return null;
        return { cacheable: true };
    }

    parseRequest(requestBody: string): ParsedRequest {
        try {
            const body = JSON.parse(requestBody);

            if (Array.isArray(body.messages)) {
                return {
                    type: 'chat',
                    model: body.model,
                    stream: body.stream ?? false,
                    messages: body.messages.map((m: any) => ({
                        role: String(m.role ?? ''),
                        content: summarizeContent(m.content),
                    })),
                };
            }

            if (body.input !== undefined) {
                const inputs = Array.isArray(body.input)
                    ? body.input.map((i: any) => (typeof i === 'string' ? i : JSON.stringify(i)))
                    : [typeof body.input === 'string' ? body.input : JSON.stringify(body.input)];
                return {
                    type: 'embedding',
                    model: body.model,
                    inputs,
                };
            }

            return { type: 'unknown', model: body.model, stream: body.stream ?? false };
        } catch {
            return { type: 'unknown' };
        }
    }

    parseResponse(responseBody: string): ParsedResponse {
        try {
            const body = JSON.parse(responseBody);
            const content = body.choices?.[0]?.message?.content ?? null;
            const usage = this.extractUsage(body.usage);
            return { content, usage };
        } catch {
            return { content: null, usage: null };
        }
    }

    parseStreamingResponse(ssePayload: string): ParsedResponse {
        const chunks = this.parseSSEChunks(ssePayload);
        let content = '';
        let usage: TokenUsage | null = null;

        for (const chunk of chunks) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === 'string') {
                content += delta;
            }
            if (chunk.usage) {
                usage = this.extractUsage(chunk.usage);
            }
        }

        return {
            content: content || null,
            usage,
        };
    }

    parseEmbeddingResponse(responseBody: string): ParsedEmbeddingResponse {
        try {
            const body = JSON.parse(responseBody);
            const usage = body.usage;
            if (!usage) return { tokens: null };
            const tokens = typeof usage.total_tokens === 'number'
                ? usage.total_tokens
                : typeof usage.prompt_tokens === 'number'
                    ? usage.prompt_tokens
                    : null;
            return { tokens };
        } catch {
            return { tokens: null };
        }
    }

    private extractUsage(usage: any): TokenUsage | null {
        if (!usage) return null;

        const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
        const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;

        return {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
        };
    }

    private parseSSEChunks(payload: string): any[] {
        const chunks: any[] = [];
        const lines = payload.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;
            try {
                chunks.push(JSON.parse(data));
            } catch {
                // skip malformed chunks
            }
        }

        return chunks;
    }
}
