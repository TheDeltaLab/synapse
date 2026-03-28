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
