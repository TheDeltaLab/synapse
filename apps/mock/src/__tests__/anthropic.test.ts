import { describe, it, expect } from 'vitest';
import { anthropicApp } from '../providers/anthropic.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

describe('Anthropic Mock Provider', () => {
    describe('GET /health', () => {
        it('should return ok status', async () => {
            const res = await anthropicApp.request('/health');
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body).toEqual({ status: 'ok', provider: 'anthropic-mock' });
        });
    });

    describe('POST /v1/messages', () => {
        it('should return 501 with Anthropic error format', async () => {
            const res = await anthropicApp.request('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(501);
            const body = (await res.json()) as Json;
            expect(body.type).toBe('error');
            expect(body.error).toBeDefined();
            expect(body.error.type).toBe('not_implemented');
            expect(body.error.message).toBeTruthy();
        });
    });

    describe('Not Found', () => {
        it('should return 404 with Anthropic error shape', async () => {
            const res = await anthropicApp.request('/v1/unknown');
            expect(res.status).toBe(404);
            const body = (await res.json()) as Json;
            expect(body.type).toBe('error');
            expect(body.error.type).toBe('not_found_error');
        });
    });
});
