import type { ProviderAdapter, ParsedResponse, ParsedRequest, ParsedEmbeddingResponse, TokenUsage, RouteMatch } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATIC_PATHS = new Set([
    '/v1beta/openai/chat/completions',
    '/v1beta/openai/embeddings',
    '/v1beta/openai/completions',
    '/v1beta/openai/responses',
]);

// Matches /v1beta/models/<model>:<action> where action is one of the allowed Gemini actions
const DYNAMIC_PATH_PATTERN = /^\/v1beta\/models\/[^/]+:(generateContent|streamGenerateContent|embedContent)$/;

export class GoogleAdapter implements ProviderAdapter {
    readonly style = 'google';

    matchRoute(method: string, path: string): RouteMatch | null {
        if (method !== 'POST') return null;
        if (STATIC_PATHS.has(path)) return { cacheable: true };
        if (DYNAMIC_PATH_PATTERN.test(path)) return { cacheable: true };
        return null;
    }

    parseRequest(requestBody: string): ParsedRequest {
        try {
            const body = JSON.parse(requestBody);

            // Gemini chat: { contents: [{ role, parts: [{ text }] }] }
            if (Array.isArray(body.contents)) {
                return {
                    type: 'chat',
                    model: body.model,
                    stream: body.stream ?? false,
                    messages: body.contents.map((c: any) => ({
                        role: String(c.role ?? ''),
                        content: Array.isArray(c.parts)
                            ? (c.parts as any[])
                                    .map((p: any) => {
                                        if (typeof p.text === 'string') return p.text;
                                        if (p.inlineData) return '[media]';
                                        return '[unknown]';
                                    })
                                    .join('')
                            : '',
                    })),
                };
            }

            // Gemini embedding: { content: { parts: [{ text }] } }
            if (body.content?.parts && !body.contents) {
                const texts = Array.isArray(body.content.parts)
                    ? (body.content.parts as any[])
                            .filter((p: any) => typeof p.text === 'string')
                            .map((p: any) => p.text as string)
                    : [];
                return {
                    type: 'embedding',
                    model: body.model,
                    inputs: texts,
                };
            }

            return { type: 'unknown', model: body.model };
        } catch {
            return { type: 'unknown' };
        }
    }

    parseResponse(responseBody: string): ParsedResponse {
        try {
            const body = JSON.parse(responseBody);
            const content = this.extractContent(body);
            const usage = this.extractUsage(body.usageMetadata);
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
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    if (typeof part.text === 'string') {
                        content += part.text;
                    }
                }
            }
            if (chunk.usageMetadata) {
                usage = this.extractUsage(chunk.usageMetadata);
            }
        }

        return {
            content: content || null,
            usage,
        };
    }

    parseEmbeddingResponse(responseBody: string): ParsedEmbeddingResponse {
        // Google embedContent responses do not include token usage
        try {
            const body = JSON.parse(responseBody);
            const single = body.embedding?.values;
            const batch = body.embeddings?.[0]?.values;
            const vec = Array.isArray(single) ? single : Array.isArray(batch) ? batch : null;
            return { tokens: null, dimensions: vec ? vec.length : null };
        } catch {
            return { tokens: null, dimensions: null };
        }
    }

    private extractContent(body: Record<string, unknown>): string | null {
        const candidates = body.candidates as Record<string, unknown>[] | undefined;
        const parts = candidates?.[0]?.content as Record<string, unknown> | undefined;
        const partsArr = parts?.parts as Record<string, unknown>[] | undefined;
        if (!Array.isArray(partsArr)) return null;

        const texts = partsArr
            .filter(p => typeof p.text === 'string')
            .map(p => p.text as string);
        return texts.length > 0 ? texts.join('') : null;
    }

    private extractUsage(metadata: Record<string, unknown> | undefined): TokenUsage | null {
        if (!metadata) return null;

        const promptTokens = typeof metadata.promptTokenCount === 'number' ? metadata.promptTokenCount : 0;
        const outputTokens = typeof metadata.candidatesTokenCount === 'number' ? metadata.candidatesTokenCount : 0;

        return {
            inputTokens: promptTokens,
            outputTokens,
        };
    }

    private parseSSEChunks(payload: string): Record<string, any>[] {
        const chunks: Record<string, any>[] = [];
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
