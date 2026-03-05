import type { ChunkMetadata, StreamingAdapter } from './types.js';

/**
 * Anthropic-style SSE streaming adapter
 * Format: event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"..."}}\n\n
 */
export class AnthropicAdapter implements StreamingAdapter {
    readonly style = 'anthropic';

    formatChunk(chunk: string, metadata: ChunkMetadata): string {
        const data = {
            type: 'content_block_delta',
            index: metadata.index ?? 0,
            delta: {
                type: 'text_delta',
                text: chunk,
            },
        };
        return `event: content_block_delta\ndata: ${JSON.stringify(data)}\n\n`;
    }

    formatFinalChunk(_metadata: ChunkMetadata): string {
        // Anthropic sends a message_delta event with stop_reason
        const data = {
            type: 'message_delta',
            delta: {
                stop_reason: 'end_turn',
                stop_sequence: null,
            },
        };
        return `event: message_delta\ndata: ${JSON.stringify(data)}\n\n`;
    }

    formatDone(): string {
        return 'event: message_stop\ndata: {}\n\n';
    }

    getResponseHeaders(): Record<string, string> {
        return {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        };
    }
}
