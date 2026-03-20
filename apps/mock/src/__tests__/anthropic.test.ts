import { describe, it, expect } from 'vitest';
import { anthropicApp } from '../providers/anthropic.js';
import { MOCK_RESPONSE_TEXT } from '../utils/constants.js';

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
        it('should return mock response in Anthropic format', async () => {
            const res = await anthropicApp.request('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.type).toBe('message');
            expect(body.role).toBe('assistant');
            expect(body.model).toBe('claude-sonnet-4-20250514');
            expect(body.content).toHaveLength(1);
            expect(body.content[0].type).toBe('text');
            expect(body.content[0].text).toBe(MOCK_RESPONSE_TEXT);
            expect(body.stop_reason).toBe('end_turn');
            expect(body.stop_sequence).toBeNull();
            expect(body.usage).toBeDefined();
            expect(body.usage.input_tokens).toBeGreaterThan(0);
            expect(body.usage.output_tokens).toBeGreaterThan(0);
        });

        it('should use default model when not specified', async () => {
            const res = await anthropicApp.request('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'hello' }],
                }),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as Json;
            expect(body.model).toBe('claude-sonnet-4-20250514');
        });

        it('should return SSE stream when stream=true', async () => {
            const res = await anthropicApp.request('/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: 'hello' }],
                    stream: true,
                }),
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toBe('text/event-stream');

            const text = await res.text();

            // Verify event types are present
            expect(text).toContain('event: message_start');
            expect(text).toContain('event: content_block_start');
            expect(text).toContain('event: content_block_delta');
            expect(text).toContain('event: content_block_stop');
            expect(text).toContain('event: message_delta');
            expect(text).toContain('event: message_stop');

            // Verify the content delta contains mock response
            const dataLines = text.split('\n').filter(l => l.startsWith('data: '));
            const deltaLine = dataLines.find((l) => {
                const data = JSON.parse(l.slice(6));
                return data.type === 'content_block_delta' && data.delta?.text === MOCK_RESPONSE_TEXT;
            });
            expect(deltaLine).toBeDefined();
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
