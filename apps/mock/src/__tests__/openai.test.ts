import { describe, it, expect } from 'vitest';
import { openaiApp } from '../providers/openai.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('OpenAI Mock Provider', () => {
    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await openaiApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'openai-mock' });
        });
    });

    describe('GET /v1/models', () => {
        it('should return a list of models', async () => {
            const res = await openaiApp.request('/v1/models');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.object).toBe('list');
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBeGreaterThan(0);

            const model = body.data[0];
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('object', 'model');
            expect(model).toHaveProperty('created');
            expect(model).toHaveProperty('owned_by', 'openai-mock');
        });
    });

    describe('POST /v1/chat/completions', () => {
        it('should return 501 with OpenAI error format', async () => {
            const res = await openaiApp.request('/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(501);
            const body = (await res.json()) as Json;
            expect(body.error).toBeDefined();
            expect(body.error.type).toBe('api_error');
            expect(body.error.code).toBe('not_implemented');
            expect(body.error.param).toBeNull();
            expect(body.error.message).toBeTruthy();
        });
    });

    describe('POST /v1/embeddings', () => {
        it('should return embedding for a single string input', async () => {
            const res = await openaiApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await openaiApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await openaiApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await openaiApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await openaiApp.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await openaiApp.request('/v1/unknown');
            expect(res.status).toBe(404);
            const body = (await res.json()) as Json;
            expect(body.error).toBeDefined();
            expect(body.error.type).toBe('invalid_request_error');
            expect(body.error.code).toBe('unknown_url');
        });
    });
});
