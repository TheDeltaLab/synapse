import { describe, it, expect } from 'vitest';
import { openrouterApp } from '../providers/openrouter.js';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('OpenRouter Mock Provider', () => {
    const authHeaders = { Authorization: 'Bearer test-key' };

    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await openrouterApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'openrouter-mock' });
        });
    });

    describe('Auth', () => {
        it('should return 401 without Authorization header', async () => {
            const res = await openrouterApp.request('/v1/models');
            expect(res.status).toBe(401);
            const body = (await res.json()) as Json;
            expect(body.error.type).toBe('invalid_request_error');
            expect(body.error.code).toBe('invalid_api_key');
        });
    });

    describe('GET /v1/models', () => {
        it('should return a list of models', async () => {
            const res = await openrouterApp.request('/v1/models', {
                headers: authHeaders,
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('list');
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBeGreaterThan(0);

            const model = body.data[0];
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('object', 'model');
            expect(model).toHaveProperty('created');
            expect(model).toHaveProperty('owned_by', 'openrouter-mock');
        });
    });

    describe('POST /v1/chat/completions', () => {
        it('should return mock response in OpenAI format', async () => {
            const res = await openrouterApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'gpt-5-mini',
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('chat.completion');
            expect(body.model).toBe('gpt-5-mini');
            expect(body.choices).toHaveLength(1);
            expect(body.choices[0].index).toBe(0);
            expect(body.choices[0].message.role).toBe('assistant');
            expect(body.choices[0].message.content).toBe(MOCK_RESPONSE_TEXT);
            expect(body.choices[0].finish_reason).toBe('stop');
            expect(body.usage).toBeDefined();
            expect(body.usage.prompt_tokens).toBeGreaterThan(0);
            expect(body.usage.completion_tokens).toBeGreaterThan(0);
            expect(body.usage.total_tokens).toBe(body.usage.prompt_tokens + body.usage.completion_tokens);
        });

        it('should use default model when not specified', async () => {
            const res = await openrouterApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.model).toBe('gpt-5-mini');
        });

        it('should return SSE stream when stream=true', async () => {
            const res = await openrouterApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'gpt-5-mini',
                    messages: [{ role: 'user', content: 'hello' }],
                    stream: true,
                }),
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/event-stream');

            const text = await res.text();
            const lines = text.split('\n').filter(l => l.startsWith('data: '));
            expect(lines.length).toBeGreaterThanOrEqual(3); // role, content, finish

            // Verify content chunk contains mock response
            const contentLine = lines.find((l) => {
                if (l === 'data: [DONE]') return false;
                const data = JSON.parse(l.slice(6));
                return data.choices?.[0]?.delta?.content === MOCK_RESPONSE_TEXT;
            });
            expect(contentLine).toBeDefined();

            // Verify [DONE] signal
            expect(text).toContain('data: [DONE]');
        });
    });

    describe('POST /v1/embeddings', () => {
        it('should return embedding for a single string input', async () => {
            const res = await openrouterApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'hello world',
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('list');
            expect(body.model).toBe('text-embedding-3-small');
            expect(body.data).toHaveLength(1);

            const embedding = body.data[0];
            expect(embedding.object).toBe('embedding');
            expect(embedding.index).toBe(0);
            expect(embedding.embedding).toHaveLength(1536);
        });

        it('should return embeddings for array input', async () => {
            const res = await openrouterApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: ['hello', 'world', 'test'],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.data).toHaveLength(3);
            expect(body.data[0].index).toBe(0);
            expect(body.data[1].index).toBe(1);
            expect(body.data[2].index).toBe(2);
        });

        it('should respect custom dimensions parameter', async () => {
            const res = await openrouterApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'hello',
                    dimensions: 256,
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.data[0].embedding).toHaveLength(256);
        });

        it('should use model default dimension for text-embedding-3-large', async () => {
            const res = await openrouterApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-3-large',
                    input: 'hello',
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.data[0].embedding).toHaveLength(3072);
        });

        it('should include usage information', async () => {
            const res = await openrouterApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'hello',
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.usage).toBeDefined();
            expect(body.usage.prompt_tokens).toBeGreaterThan(0);
            expect(body.usage.total_tokens).toBeGreaterThan(0);
        });
    });

    describe('Not Found', () => {
        it('should return 404 with OpenAI error shape', async () => {
            const res = await openrouterApp.request('/v1/unknown', {
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
