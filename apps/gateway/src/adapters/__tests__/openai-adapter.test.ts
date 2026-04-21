import { describe, expect, it } from 'vitest';
import { OpenAIAdapter } from '../openai-adapter.js';

const adapter = new OpenAIAdapter();

describe('OpenAIAdapter', () => {
    describe('parseRequest', () => {
        it('should parse a chat request with messages', () => {
            const body = JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are helpful.' },
                    { role: 'user', content: 'Hello' },
                ],
                stream: true,
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.model).toBe('gpt-4o');
            expect(result.stream).toBe(true);
            expect(result.messages).toEqual([
                { role: 'system', content: 'You are helpful.' },
                { role: 'user', content: 'Hello' },
            ]);
        });

        it('should summarize multi-modal content blocks for logging', () => {
            const body = JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'user', content: [{ type: 'text', text: 'hi' }] },
                ],
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('chat');
            expect(result.messages![0]!.content).toBe('hi');
        });

        it('should replace audio and image blocks with placeholders', () => {
            const body = JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Describe this: ' },
                            { type: 'input_audio', input_audio: { data: 'base64...', format: 'wav' } },
                            { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
                        ],
                    },
                ],
            });

            const result = adapter.parseRequest(body);
            expect(result.messages![0]!.content).toBe('Describe this: [audio][image]');
        });

        it('should parse an embedding request with string input', () => {
            const body = JSON.stringify({
                model: 'text-embedding-3-small',
                input: 'Hello, world!',
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('embedding');
            expect(result.model).toBe('text-embedding-3-small');
            expect(result.inputs).toEqual(['Hello, world!']);
        });

        it('should parse an embedding request with array input', () => {
            const body = JSON.stringify({
                model: 'text-embedding-3-small',
                input: ['Hello', 'World'],
            });

            const result = adapter.parseRequest(body);
            expect(result.type).toBe('embedding');
            expect(result.inputs).toEqual(['Hello', 'World']);
        });

        it('should return unknown for invalid JSON', () => {
            const result = adapter.parseRequest('not json');
            expect(result.type).toBe('unknown');
        });

        it('should return unknown for body without messages or input', () => {
            const body = JSON.stringify({ model: 'gpt-4o' });
            const result = adapter.parseRequest(body);
            expect(result.type).toBe('unknown');
            expect(result.model).toBe('gpt-4o');
        });
    });

    describe('parseResponse', () => {
        it('should parse a standard response', () => {
            const body = JSON.stringify({
                choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Hello!');
            expect(result.usage).toEqual({
                inputTokens: 10,
                outputTokens: 5,
            });
        });

        it('should parse a response with cached_tokens', () => {
            const body = JSON.stringify({
                choices: [{ message: { role: 'assistant', content: 'Cached reply' } }],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 20,
                    total_tokens: 120,
                    prompt_tokens_details: {
                        cached_tokens: 80,
                    },
                },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('Cached reply');
            expect(result.usage).toEqual({
                inputTokens: 100,
                outputTokens: 20,
            });
        });

        it('should handle missing usage', () => {
            const body = JSON.stringify({
                choices: [{ message: { role: 'assistant', content: 'No usage' } }],
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBe('No usage');
            expect(result.usage).toBeNull();
        });

        it('should handle empty choices', () => {
            const body = JSON.stringify({
                choices: [],
                usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
            });

            const result = adapter.parseResponse(body);
            expect(result.content).toBeNull();
        });

        it('should handle invalid JSON', () => {
            const result = adapter.parseResponse('not json');
            expect(result.content).toBeNull();
            expect(result.usage).toBeNull();
        });
    });

    describe('parseStreamingResponse', () => {
        it('should parse streaming chunks with usage', () => {
            const payload = [
                'data: {"choices":[{"delta":{"content":"Hel"}}]}',
                '',
                'data: {"choices":[{"delta":{"content":"lo!"}}]}',
                '',
                'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}',
                '',
                'data: [DONE]',
            ].join('\n');

            const result = adapter.parseStreamingResponse(payload);
            expect(result.content).toBe('Hello!');
            expect(result.usage).toEqual({
                inputTokens: 10,
                outputTokens: 2,
            });
        });

        it('should return null usage when no usage chunk', () => {
            const payload = [
                'data: {"choices":[{"delta":{"content":"Hi"}}]}',
                '',
                'data: [DONE]',
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

        it('should handle malformed SSE lines', () => {
            const payload = [
                'data: not-json',
                '',
                'data: {"choices":[{"delta":{"content":"ok"}}]}',
            ].join('\n');

            const result = adapter.parseStreamingResponse(payload);
            expect(result.content).toBe('ok');
        });
    });

    describe('matchRoute', () => {
        it('should match POST /v1/chat/completions', () => {
            const result = adapter.matchRoute('POST', '/v1/chat/completions');
            expect(result).toEqual({ cacheable: true });
        });

        it('should match POST /v1/embeddings', () => {
            const result = adapter.matchRoute('POST', '/v1/embeddings');
            expect(result).toEqual({ cacheable: true });
        });

        it('should match POST /v1/completions', () => {
            const result = adapter.matchRoute('POST', '/v1/completions');
            expect(result).toEqual({ cacheable: true });
        });

        it('should match POST /v1/responses', () => {
            const result = adapter.matchRoute('POST', '/v1/responses');
            expect(result).toEqual({ cacheable: true });
        });

        it('should reject GET method', () => {
            expect(adapter.matchRoute('GET', '/v1/chat/completions')).toBeNull();
        });

        it('should reject unknown path', () => {
            expect(adapter.matchRoute('POST', '/v1/models')).toBeNull();
        });

        it('should reject Anthropic path', () => {
            expect(adapter.matchRoute('POST', '/v1/messages')).toBeNull();
        });
    });

    describe('parseEmbeddingResponse', () => {
        it('should extract total_tokens from usage', () => {
            const body = JSON.stringify({
                object: 'list',
                data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
                model: 'text-embedding-3-small',
                usage: { prompt_tokens: 5, total_tokens: 5 },
            });

            const result = adapter.parseEmbeddingResponse(body);
            expect(result.tokens).toBe(5);
        });

        it('should fallback to prompt_tokens when total_tokens is missing', () => {
            const body = JSON.stringify({
                usage: { prompt_tokens: 8 },
            });

            const result = adapter.parseEmbeddingResponse(body);
            expect(result.tokens).toBe(8);
        });

        it('should return null when usage is missing', () => {
            const body = JSON.stringify({
                object: 'list',
                data: [],
            });

            const result = adapter.parseEmbeddingResponse(body);
            expect(result.tokens).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            const result = adapter.parseEmbeddingResponse('not json');
            expect(result.tokens).toBeNull();
        });
    });
});
