import { describe, it, expect } from 'vitest';
import { alibabaApp } from '../providers/alibaba.js';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('Alibaba Mock Provider', () => {
    const authHeaders = { Authorization: 'Bearer test-key' };

    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await alibabaApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'alibaba-mock' });
        });
    });

    describe('Auth', () => {
        it('should return 401 without Authorization header', async () => {
            const res = await alibabaApp.request('/v1/models');
            expect(res.status).toBe(401);
            const body = (await res.json()) as Json;
            expect(body.error.type).toBe('invalid_request_error');
            expect(body.error.code).toBe('invalid_api_key');
        });

        it('should return 401 with empty Bearer token', async () => {
            const res = await alibabaApp.request('/v1/models', {
                headers: { Authorization: 'Bearer ' },
            });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /v1/models', () => {
        it('should return a list of Alibaba models', async () => {
            const res = await alibabaApp.request('/v1/models', {
                headers: authHeaders,
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('list');
            expect(Array.isArray(body.data)).toBe(true);

            const ids = body.data.map((m: Json) => m.id);
            expect(ids).toContain('qwen3.5-omni-plus');
            expect(ids).toContain('text-embedding-v4');

            const model = body.data[0];
            expect(model).toHaveProperty('owned_by', 'alibaba-mock');
        });
    });

    describe('POST /v1/chat/completions', () => {
        it('should return mock response in OpenAI format', async () => {
            const res = await alibabaApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'qwen3.5-omni-plus',
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('chat.completion');
            expect(body.model).toBe('qwen3.5-omni-plus');
            expect(body.choices).toHaveLength(1);
            expect(body.choices[0].message.role).toBe('assistant');
            expect(body.choices[0].message.content).toBe(MOCK_RESPONSE_TEXT);
            expect(body.choices[0].finish_reason).toBe('stop');
            expect(body.usage.prompt_tokens).toBeGreaterThan(0);
            expect(body.usage.completion_tokens).toBeGreaterThan(0);
            expect(body.usage.total_tokens).toBe(body.usage.prompt_tokens + body.usage.completion_tokens);
        });

        it('should use default model when not specified', async () => {
            const res = await alibabaApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.model).toBe('qwen3.5-omni-plus');
        });

        it('should return SSE stream when stream=true', async () => {
            const res = await alibabaApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'qwen3.5-omni-plus',
                    messages: [{ role: 'user', content: 'hello' }],
                    stream: true,
                }),
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/event-stream');

            const text = await res.text();
            const lines = text.split('\n').filter(l => l.startsWith('data: '));
            expect(lines.length).toBeGreaterThanOrEqual(3);

            const contentLine = lines.find((l) => {
                if (l === 'data: [DONE]') return false;
                const data = JSON.parse(l.slice(6));
                return data.choices?.[0]?.delta?.content === MOCK_RESPONSE_TEXT;
            });
            expect(contentLine).toBeDefined();
            expect(text).toContain('data: [DONE]');
        });

        it('should handle multimodal content with audio blocks', async () => {
            const res = await alibabaApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'qwen3.5-omni-plus',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Transcribe this audio' },
                                {
                                    type: 'input_audio',
                                    input_audio: { data: 'base64audiodata', format: 'wav' },
                                },
                            ],
                        },
                    ],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.choices[0].message.content).toBe(MOCK_RESPONSE_TEXT);
            // Text block: ceil(21/4)=6, audio block: 100 => total prompt ~106
            expect(body.usage.prompt_tokens).toBeGreaterThanOrEqual(100);
        });

        it('should handle multimodal content with image blocks', async () => {
            const res = await alibabaApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'qwen3.5-omni-plus',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Describe this image' },
                                {
                                    type: 'image_url',
                                    image_url: { url: 'https://example.com/image.png' },
                                },
                            ],
                        },
                    ],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            // Text block: ceil(19/4)=5, image block: 50 => total prompt ~55
            expect(body.usage.prompt_tokens).toBeGreaterThanOrEqual(50);
        });
    });

    describe('POST /v1/embeddings', () => {
        it('should return embedding for a single string input', async () => {
            const res = await alibabaApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-v4',
                    input: 'hello world',
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('list');
            expect(body.model).toBe('text-embedding-v4');
            expect(body.data).toHaveLength(1);
            expect(body.data[0].object).toBe('embedding');
            expect(body.data[0].index).toBe(0);
            expect(Array.isArray(body.data[0].embedding)).toBe(true);
        });

        it('should return embeddings for array input', async () => {
            const res = await alibabaApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-v4',
                    input: ['hello', 'world'],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.data).toHaveLength(2);
        });

        it('should include usage information', async () => {
            const res = await alibabaApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-v4',
                    input: 'hello',
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.usage.prompt_tokens).toBeGreaterThan(0);
            expect(body.usage.total_tokens).toBeGreaterThan(0);
        });
    });

    describe('Not Found', () => {
        it('should return 404 with error shape', async () => {
            const res = await alibabaApp.request('/v1/unknown', {
                headers: authHeaders,
            });
            expect(res.status).toBe(404);
            const body = (await res.json()) as Json;
            expect(body.error).toBeDefined();
            expect(body.error.type).toBe('invalid_request_error');
            expect(body.error.code).toBe('unknown_url');
        });
    });
});
