import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEmbeddings } from '../embeddings.js';

// Mock the provider registry
vi.mock('../../../services/provider-registry.js', () => ({
    providerRegistry: {
        hasEmbeddingSupport: vi.fn((provider: string) => {
            return provider !== 'anthropic';
        }),
        getAvailableEmbeddingProviders: vi.fn(() => ['openai', 'google', 'openrouter']),
        getEmbeddingModel: vi.fn(() => ({
            modelId: 'text-embedding-3-small',
            specificationVersion: 'v3',
        })),
    },
}));

// Mock the AI SDK embedMany function
vi.mock('ai', () => ({
    embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4, 0.5]),
        usage: { tokens: values.length * 5 },
    })),
}));

describe('handleEmbeddings', () => {
    let app: Hono;

    beforeEach(() => {
        vi.clearAllMocks();
        app = new Hono();
        app.post('/v1/embeddings', handleEmbeddings);
    });

    describe('request validation', () => {
        it('should return 400 for missing model', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: 'test' }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.type).toBe('invalid_request_error');
        });

        it('should return 400 for missing input', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small' }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.type).toBe('invalid_request_error');
        });

        it('should return 400 for empty input string', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small', input: '' }),
            });

            expect(res.status).toBe(400);
        });

        it('should return 400 for empty input array', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small', input: [] }),
            });

            expect(res.status).toBe(400);
        });
    });

    describe('provider validation', () => {
        it('should return 400 for unsupported provider', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-synapse-provider': 'anthropic',
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'test',
                }),
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.message).toContain('does not support embeddings');
            expect(json.error.code).toBe('unsupported_provider');
        });
    });

    describe('successful requests', () => {
        it('should return embeddings for single input', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'Hello, world!',
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.object).toBe('list');
            expect(json.data).toHaveLength(1);
            expect(json.data[0].object).toBe('embedding');
            expect(json.data[0].index).toBe(0);
            expect(Array.isArray(json.data[0].embedding)).toBe(true);
            expect(json.model).toBe('text-embedding-3-small');
            expect(json.usage).toHaveProperty('prompt_tokens');
            expect(json.usage).toHaveProperty('total_tokens');
        });

        it('should return embeddings for array input', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: ['Hello', 'World', 'Test'],
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data).toHaveLength(3);
            expect(json.data[0].index).toBe(0);
            expect(json.data[1].index).toBe(1);
            expect(json.data[2].index).toBe(2);
        });

        it('should return base64 encoded embeddings when requested', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'test',
                    encoding_format: 'base64',
                }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(typeof json.data[0].embedding).toBe('string');
            // Base64 encoded string should be decodable
            expect(() => atob(json.data[0].embedding)).not.toThrow();
        });

        it('should use provider from header when specified', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-synapse-provider': 'google',
                },
                body: JSON.stringify({
                    model: 'text-embedding-004',
                    input: 'test',
                }),
            });

            expect(res.status).toBe(200);
        });
    });

    describe('response format', () => {
        it('should return OpenAI-compatible response structure', async () => {
            const res = await app.request('/v1/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: 'test',
                }),
            });

            const json = await res.json();

            // Check top-level structure
            expect(json).toHaveProperty('object', 'list');
            expect(json).toHaveProperty('data');
            expect(json).toHaveProperty('model');
            expect(json).toHaveProperty('usage');

            // Check data item structure
            expect(json.data[0]).toHaveProperty('object', 'embedding');
            expect(json.data[0]).toHaveProperty('index');
            expect(json.data[0]).toHaveProperty('embedding');

            // Check usage structure
            expect(json.usage).toHaveProperty('prompt_tokens');
            expect(json.usage).toHaveProperty('total_tokens');
        });
    });
});
