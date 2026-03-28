import type { ProviderAdapter, ParsedResponse, ParsedRequest, ParsedEmbeddingResponse, TokenUsage, RouteMatch } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_PATHS = new Set([
    '/v1/messages',
]);

export class AnthropicAdapter implements ProviderAdapter {
    readonly style = 'anthropic';

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
                        content: typeof m.content === 'string'
                            ? m.content
                            : Array.isArray(m.content)
                                ? (m.content as any[])
                                        .filter((b: any) => b.type === 'text')
                                        .map((b: any) => b.text as string)
                                        .join('')
                                : JSON.stringify(m.content),
                    })),
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
            const content = this.extractContent(body.content);
            const usage = this.extractUsage(body.usage);
            return { content, usage };
        } catch {
            return { content: null, usage: null };
        }
    }

    parseStreamingResponse(ssePayload: string): ParsedResponse {
        const events = this.parseSSEEvents(ssePayload);
        let content = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let hasUsage = false;

        for (const event of events) {
            switch (event.type) {
                case 'message_start': {
                    const usage = event.data?.message?.usage;
                    if (usage) {
                        hasUsage = true;
                        inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
                    }
                    break;
                }
                case 'content_block_delta': {
                    const delta = event.data?.delta;
                    if (delta?.type === 'text_delta' && typeof delta?.text === 'string') {
                        content += delta.text;
                    }
                    break;
                }
                case 'message_delta': {
                    const usage = event.data?.usage;
                    if (usage) {
                        hasUsage = true;
                        outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
                    }
                    break;
                }
            }
        }

        return {
            content: content || null,
            usage: hasUsage ? {
                inputTokens: inputTokens,
                outputTokens,
            } : null,
        };
    }

    parseEmbeddingResponse(_responseBody: string): ParsedEmbeddingResponse {
        // Anthropic does not offer an embedding API
        return { tokens: null };
    }

    private extractContent(contentBlocks: any): string | null {
        if (!Array.isArray(contentBlocks)) return null;
        const texts = contentBlocks
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text as string);
        return texts.length > 0 ? texts.join('') : null;
    }

    private extractUsage(usage: any): TokenUsage | null {
        if (!usage) return null;

        const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
        const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;

        return {
            inputTokens: inputTokens,
            outputTokens,
        };
    }

    private parseSSEEvents(payload: string): { type: string; data: any }[] {
        const events: { type: string; data: any }[] = [];
        const blocks = payload.split('\n\n');

        for (const block of blocks) {
            const lines = block.trim().split('\n');
            let eventType = '';
            let dataStr = '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    dataStr = line.slice(6);
                }
            }

            if (eventType && dataStr) {
                try {
                    events.push({ type: eventType, data: JSON.parse(dataStr) });
                } catch {
                    // skip malformed events
                }
            }
        }

        return events;
    }
}
