import type { ChunkMetadata, StreamingAdapter } from './types.js';

/**
 * Google (Gemini)-style SSE streaming adapter
 * Format: data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}\n\n
 */
export class GoogleAdapter implements StreamingAdapter {
    readonly style = 'google';

    formatChunk(chunk: string, metadata: ChunkMetadata): string {
        const data = {
            candidates: [
                {
                    content: {
                        parts: [{ text: chunk }],
                        role: 'model',
                    },
                    index: metadata.index ?? 0,
                },
            ],
            modelVersion: metadata.model,
        };
        return `data: ${JSON.stringify(data)}\n\n`;
    }

    formatFinalChunk(metadata: ChunkMetadata): string {
        const data = {
            candidates: [
                {
                    content: {
                        parts: [],
                        role: 'model',
                    },
                    finishReason: 'STOP',
                    index: metadata.index ?? 0,
                },
            ],
            modelVersion: metadata.model,
        };
        return `data: ${JSON.stringify(data)}\n\n`;
    }

    formatDone(): string {
        return 'data: [DONE]\n\n';
    }

    getResponseHeaders(): Record<string, string> {
        return {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        };
    }
}
