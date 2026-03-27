import { describe, expect, it } from 'vitest';
import { AnthropicAdapter } from '../anthropic-adapter.js';

const adapter = new AnthropicAdapter();

describe('AnthropicAdapter', () => {
    describe('parseRequest', () => {
        it('should parse a chat request with string content', () => {
            const body = JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                messages: [
                    { role: 'user', content: 'Hello' },
                ],
                stream: false,
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.model).toBe('claude-sonnet-4-20250514');
            expect(result.stream).toBe(false);
            expect(result.messages).toEqual([
                { role: 'user', content: 'Hello' },
            ]);
        });

        it('should join text blocks from content array', () => {
            const body = JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Part 1' },
                            { type: 'image', source: {} },
                            { type: 'text', text: 'Part 2' },
                        ],
                    },
                ],
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.messages![0]!.content).toBe('Part 1Part 2');
        });

        it('should return unknown for body without messages', () => {
            const body = JSON.stringify({ model: 'claude-sonnet-4-20250514' });
            const result = adapter.parseRequest(body);
            expect(result.type).toBe('unknown');
            expect(result.model).toBe('claude-sonnet-4-20250514');
        });

        it('should return unknown for invalid JSON', () => {
            const result = adapter.parseRequest('not json');
            expect(result.type).toBe('unknown');
        });
    });

    describe('parseResponse', () => {
        it('should parse a standard response', () => {
            const body = JSON.stringify({
                content: [{ type: 'text', text: 'Hello from Claude!' }],
                usage: {
                    input_tokens: 15,
                    output_tokens: 8,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Hello from Claude!');
            expect(result.usage).toEqual({
                inputTokens: 15,
                outputTokens: 8,
            });
        });

        it('should parse a response with cache_read_input_tokens', () => {
            const body = JSON.stringify({
                content: [{ type: 'text', text: 'Cached response' }],
                usage: {
                    input_tokens: 100,
                    cache_read_input_tokens: 60,
                    output_tokens: 10,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Cached response');
            expect(result.usage).toEqual({
                inputTokens: 100,
                outputTokens: 10,
            });
        });

        it('should join multiple text blocks', () => {
            const body = JSON.stringify({
                content: [
                    { type: 'text', text: 'Part 1' },
                    { type: 'tool_use', id: 'tool1' },
                    { type: 'text', text: 'Part 2' },
                ],
                usage: { input_tokens: 5, output_tokens: 3 },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Part 1Part 2');
        });

        it('should handle missing usage', () => {
            const body = JSON.stringify({
                content: [{ type: 'text', text: 'No usage' }],
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
        it('should parse streaming events', () => {
            const payload = [
                'event: message_start',
                'data: {"type":"message_start","message":{"usage":{"input_tokens":20,"cache_read_input_tokens":5}}}',
                '',
                'event: content_block_delta',
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
                '',
                'event: content_block_delta',
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
                '',
                'event: message_delta',
                'data: {"type":"message_delta","usage":{"output_tokens":10}}',
                '',
            ].join('\n');

            const result = adapter.parseStreamingResponse(payload);
            expect(result.content).toBe('Hello world');
            expect(result.usage).toEqual({
                inputTokens: 20,
                outputTokens: 10,
            });
        });

        it('should handle missing usage events', () => {
            const payload = [
                'event: content_block_delta',
                'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
                '',
            ].join('\n');

            const result = adapter.parseStreamingResponse(payload);
            expect(result.content).toBe('Hi');
            expect(result.usage).toBeNull();
        });

        it('should handle empty payload', () => {
            const result = adapter.parseStreamingResponse('');
            expect(result.content).toBeNull();
            expect(result.usage).toBeNull();
        });
    });

    describe('parseEmbeddingResponse', () => {
        it('should always return null tokens', () => {
            const body = JSON.stringify({ some: 'data' });
            const result = adapter.parseEmbeddingResponse(body);
            expect(result.tokens).toBeNull();
        });
    });
});
