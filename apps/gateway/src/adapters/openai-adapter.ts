import type { ChunkMetadata, StreamingAdapter } from './types.js';

/**
 * OpenAI-style SSE streaming adapter
 * Format: data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 */
export class OpenAIAdapter implements StreamingAdapter {
    readonly style = 'openai';

    formatChunk(chunk: string, metadata: ChunkMetadata): string {
        const data = {
            id: metadata.id,
            object: 'chat.completion.chunk',
            created: metadata.created,
            model: metadata.model,
            choices: [
                {
                    index: metadata.index ?? 0,
                    delta: { content: chunk },
                    finish_reason: null,
                },
            ],
        };
        return `data: ${JSON.stringify(data)}\n\n`;
    }

    formatFinalChunk(metadata: ChunkMetadata): string {
        const data = {
            id: metadata.id,
            object: 'chat.completion.chunk',
            created: metadata.created,
            model: metadata.model,
            choices: [
                {
                    index: metadata.index ?? 0,
                    delta: {},
                    finish_reason: 'stop',
                },
            ],
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
