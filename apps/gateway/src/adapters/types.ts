export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

export interface ParsedResponse {
    content: string | null;
    usage: TokenUsage | null;
}

export type RequestType = 'chat' | 'embedding' | 'unknown';

export interface ChatMessage {
    role: string;
    content: string;
}

export interface ParsedRequest {
    type: RequestType;
    model?: string;
    stream?: boolean;
    messages?: ChatMessage[];
    inputs?: string[];
}

export interface ParsedEmbeddingResponse {
    tokens: number | null;
}

export interface RouteMatch {
    cacheable: boolean;
}

export interface ProviderAdapter {
    readonly style: string;
    matchRoute(method: string, path: string): RouteMatch | null;
    parseRequest(requestBody: string): ParsedRequest;
    parseResponse(responseBody: string): ParsedResponse;
    parseStreamingResponse(ssePayload: string): ParsedResponse;
    parseEmbeddingResponse(responseBody: string): ParsedEmbeddingResponse;
}

/**
 * Summarize a multi-modal content value for logging.
 * Replaces binary-heavy blocks (audio, images) with lightweight placeholders
 * so that logs stay readable and storage stays small.
 */
export function summarizeContent(content: unknown): string {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) {
        try {
            return JSON.stringify(content) ?? String(content);
        } catch {
            return String(content);
        }
    }

    return (content as Record<string, unknown>[])
        .map((block) => {
            const type = block.type as string | undefined;
            if (type === 'text') return (block.text as string) ?? '';
            if (type === 'input_audio') return '[audio]';
            if (type === 'image_url' || type === 'image') return '[image]';
            return `[${type ?? 'unknown'}]`;
        })
        .join('');
}
