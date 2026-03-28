import { describe, it, expect } from 'vitest';
import { googleApp } from '../providers/google.js';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('Google Mock Provider', () => {
    const authHeaders = { Authorization: 'Bearer test-key' };

    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await googleApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'google-mock' });
        });
    });

    describe('Auth', () => {
        it('should return 401 without API key', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'hello' }] }],
                }),
            });
            expect(res.status).toBe(401);
            const body = (await res.json()) as Json;
            expect(body.error.code).toBe(401);
            expect(body.error.status).toBe('UNAUTHENTICATED');
        });

        it('should accept key as query parameter', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:generateContent?key=test-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'hello' }] }],
                }),
            });
            expect(res.status).toBe(200);
        });

        it('should accept Bearer token', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'hello' }] }],
                }),
            });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /v1beta/models/{model}:generateContent', () => {
        it('should return mock response in Google format', async () => {
            const res = await googleApp.request('/v1beta/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
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

    describe('POST /v1beta/models/{model}:streamGenerateContent', () => {
        it('should return SSE stream with mock response', async () => {
            const res = await googleApp.request(
                '/v1beta/models/gemini-pro:streamGenerateContent?alt=sse',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'hello' }] }],
                    }),
                },
            );
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/event-stream');

            const text = await res.text();
            // SSE format: data: <json>\n\n
            const dataLine = text.split('\n').find(line => line.startsWith('data: '));
            expect(dataLine).toBeDefined();

            const payload = JSON.parse(dataLine!.slice(6)) as Json;
            expect(payload.candidates).toHaveLength(1);
            expect(payload.candidates[0].content.parts[0].text).toBe(MOCK_RESPONSE_TEXT);
            expect(payload.candidates[0].content.role).toBe('model');
            expect(payload.candidates[0].finishReason).toBe('STOP');
            expect(payload.usageMetadata).toBeDefined();
            expect(payload.usageMetadata.promptTokenCount).toBeGreaterThan(0);
        });
    });

    describe('POST /v1beta/models/{model}:embedContent', () => {
        it('should return a single embedding', async () => {
            const res = await googleApp.request('/v1beta/models/text-embedding-004:embedContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
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
                headers: { 'Content-Type': 'application/json', ...authHeaders },
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
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
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
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
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
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({}),
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as Json;
            expect(body.error.status).toBe('INVALID_ARGUMENT');
        });
    });

    describe('Not Found', () => {
        it('should return 404 with Google error shape', async () => {
            const res = await googleApp.request('/v1/unknown', {
                headers: authHeaders,
            });
            expect(res.status).toBe(404);
            const body = (await res.json()) as Json;
            expect(body.error).toBeDefined();
            expect(body.error.code).toBe(404);
            expect(body.error.status).toBe('NOT_FOUND');
        });
    });
});
