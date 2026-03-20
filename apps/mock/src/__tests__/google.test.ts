import { describe, it, expect } from 'vitest';
import { googleApp } from '../providers/google.js';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('Google Mock Provider', () => {
    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await googleApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'google-mock' });
        });
    });

    describe('POST /v1beta/models/{model}:generateContent', () => {
        it('should return mock response in Google format', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'hello' }] }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.candidates).toHaveLength(1);
            expect(body.candidates[0].content.parts[0].text).toBe(MOCK_RESPONSE_TEXT);
            expect(body.candidates[0].content.role).toBe('model');
            expect(body.candidates[0].finishReason).toBe('STOP');
            expect(body.candidates[0].index).toBe(0);
            expect(body.modelVersion).toBe('gemini-pro');
            expect(body.usageMetadata).toBeDefined();
            expect(body.usageMetadata.promptTokenCount).toBeGreaterThan(0);
            expect(body.usageMetadata.candidatesTokenCount).toBeGreaterThan(0);
            expect(body.usageMetadata.totalTokenCount).toBe(
                body.usageMetadata.promptTokenCount + body.usageMetadata.candidatesTokenCount,
            );
        });
    });

    describe('POST /v1beta/models/{model}:embedContent', () => {
        it('should return a single embedding', async () => {
            const res = await googleApp.request('/v1beta/models/text-embedding-004:embedContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: 'hello' }] },
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.embedding).toBeDefined();
            expect(body.embedding.values).toHaveLength(768);
        });

        it('should respect custom outputDimensionality', async () => {
            const res = await googleApp.request('/v1beta/models/text-embedding-004:embedContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: 'hello' }] },
                    outputDimensionality: 256,
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.embedding.values).toHaveLength(256);
        });
    });

    describe('POST /v1beta/models/{model}:batchEmbedContents', () => {
        it('should return multiple embeddings', async () => {
            const res = await googleApp.request(
                '/v1beta/models/text-embedding-004:batchEmbedContents',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [
                            { content: { parts: [{ text: 'hello' }] } },
                            { content: { parts: [{ text: 'world' }] } },
                            { content: { parts: [{ text: 'test' }] } },
                        ],
                    }),
                },
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.embeddings).toHaveLength(3);
            for (const emb of body.embeddings) {
                expect(emb.values).toHaveLength(768);
            }
        });

        it('should handle empty requests array', async () => {
            const res = await googleApp.request(
                '/v1beta/models/text-embedding-004:batchEmbedContents',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requests: [] }),
                },
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.embeddings).toHaveLength(0);
        });
    });

    describe('Unknown action', () => {
        it('should return 400 for unknown action', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:unknownAction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as Json;
            expect(body.error.status).toBe('INVALID_ARGUMENT');
        });
    });

    describe('Not Found', () => {
        it('should return 404 with Google error shape', async () => {
            const res = await googleApp.request('/v1/unknown');
            expect(res.status).toBe(404);
            const body = (await res.json()) as Json;
            expect(body.error).toBeDefined();
            expect(body.error.code).toBe(404);
            expect(body.error.status).toBe('NOT_FOUND');
        });
    });
});
