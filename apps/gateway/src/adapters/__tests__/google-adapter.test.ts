import { describe, expect, it } from 'vitest';
import { GoogleAdapter } from '../google-adapter.js';

const adapter = new GoogleAdapter();

describe('GoogleAdapter', () => {
    describe('parseRequest', () => {
        it('should parse a chat request with contents', () => {
            const body = JSON.stringify({
                model: 'gemini-pro',
                contents: [
                    { role: 'user', parts: [{ text: 'Hello' }] },
                ],
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.model).toBe('gemini-pro');
            expect(result.messages).toEqual([
                { role: 'user', content: 'Hello' },
            ]);
        });

        it('should join multiple text parts in a message', () => {
            const body = JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: 'Part A' }, { text: 'Part B' }] },
                ],
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.messages![0]!.content).toBe('Part APart B');
        });

        it('should parse an embedding request with content.parts', () => {
            const body = JSON.stringify({
                model: 'embedding-001',
                content: {
                    parts: [{ text: 'embed me' }],
                },
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('embedding');
            expect(result.model).toBe('embedding-001');
            expect(result.inputs).toEqual(['embed me']);
        });

        it('should return unknown for body without contents or content', () => {
            const body = JSON.stringify({ model: 'gemini-pro' });
            const result = adapter.parseRequest(body);
            expect(result.type).toBe('unknown');
            expect(result.model).toBe('gemini-pro');
        });

        it('should return unknown for invalid JSON', () => {
            const result = adapter.parseRequest('not json');
            expect(result.type).toBe('unknown');
        });
    });

    describe('parseResponse', () => {
        it('should parse a standard response', () => {
            const body = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Hello from Gemini!' }],
                    },
                }],
                usageMetadata: {
                    promptTokenCount: 12,
                    candidatesTokenCount: 6,
                    totalTokenCount: 18,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Hello from Gemini!');
            expect(result.usage).toEqual({
                inputTokens: 12,
                outputTokens: 6,
            });
        });

        it('should parse a response with cachedContentTokenCount', () => {
            const body = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Cached Gemini' }],
                    },
                }],
                usageMetadata: {
                    promptTokenCount: 50,
                    cachedContentTokenCount: 30,
                    candidatesTokenCount: 10,
                    totalTokenCount: 60,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Cached Gemini');
            expect(result.usage).toEqual({
                inputTokens: 50,
                outputTokens: 10,
            });
        });

        it('should join multiple text parts', () => {
            const body = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'Part A' }, { text: 'Part B' }],
                    },
                }],
                usageMetadata: {
                    promptTokenCount: 5,
                    candidatesTokenCount: 4,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Part APart B');
        });

        it('should handle missing usageMetadata', () => {
            const body = JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{ text: 'No usage' }],
                    },
                }],
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('No usage');
            expect(result.usage).toBeNull();
        });

        it('should handle invalid JSON', () => {
            const result = adapter.parseResponse('not json');
            expect(result.content).toBeNull();
            expect(result.usage).toBeNull();
        });
    });

    describe('parseStreamingResponse', () => {
        it('should parse streaming chunks and accumulate content', () => {
            const payload = [
                'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
                '',
                'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":4}}',
                '',
                'data: [DONE]',
            ].join('\n');

            const result = adapter.parseStreamingResponse(payload);
            expect(result.content).toBe('Hello world');
            expect(result.usage).toEqual({
                inputTokens: 8,
                outputTokens: 4,
            });
        });

        it('should handle empty payload', () => {
            const result = adapter.parseStreamingResponse('');
            expect(result.content).toBeNull();
            expect(result.usage).toBeNull();
        });
    });

    describe('parseEmbeddingResponse', () => {
        it('should always return null tokens', () => {
            const body = JSON.stringify({
                embedding: { values: [0.1, 0.2, 0.3] },
            });
            const result = adapter.parseEmbeddingResponse(body);
            expect(result.tokens).toBeNull();
        });
    });
});
