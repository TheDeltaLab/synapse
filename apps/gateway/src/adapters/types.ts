/**
 * Metadata for each streaming chunk
 */
export interface ChunkMetadata {
    id: string;
    model: string;
    created: number;
    index?: number;
}

/**
 * Interface for streaming response adapters
 * Each adapter formats SSE responses in a provider-specific style
 */
export interface StreamingAdapter {
    /** The style identifier (e.g., 'openai', 'anthropic', 'google') */
    readonly style: string;

    /**
     * Format a text chunk into provider-specific SSE format
     * @param chunk - The text content to format
     * @param metadata - Chunk metadata (id, model, created timestamp)
     * @returns Formatted SSE string
     */
    formatChunk(chunk: string, metadata: ChunkMetadata): string;

    /**
     * Format the final chunk with finish_reason
     * @param metadata - Chunk metadata (id, model, created timestamp)
     * @returns Formatted SSE string for final chunk
     */
    formatFinalChunk(metadata: ChunkMetadata): string;

    /**
     * Format the stream termination marker
     * @returns Formatted SSE string for stream end
     */
    formatDone(): string;

    /**
     * Get response headers for the streaming response
     * @returns Record of header name to header value
     */
    getResponseHeaders(): Record<string, string>;
}
