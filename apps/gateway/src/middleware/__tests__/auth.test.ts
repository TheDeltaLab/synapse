import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authMiddleware } from '../auth.js';

// Mock prisma so authService doesn't need a real DB
vi.mock('@synapse/dal', () => ({
    prisma: {
        apiKey: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

// Mock redis for rate limit checks
vi.mock('../../services/redis-service.js', () => ({
    redisService: {
        available: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
    },
}));

describe('authMiddleware', () => {
    const originalAuthDisabled = process.env.AUTH_DISABLED;

    afterEach(() => {
        if (originalAuthDisabled === undefined) {
            delete process.env.AUTH_DISABLED;
        } else {
            process.env.AUTH_DISABLED = originalAuthDisabled;
        }
    });

    describe('AUTH_DISABLED=true', () => {
        beforeEach(() => {
            process.env.AUTH_DISABLED = 'true';
        });

        it('bypasses auth and sets dummy apiKey', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', (c) => {
                const apiKey = c.get('apiKey');
                return c.json({ id: apiKey.id, name: apiKey.name });
            });

            const res = await testApp.request('/test');
            expect(res.status).toBe(200);

            const body = await res.json() as { id: string; name: string };
            expect(body.id).toBe('auth-disabled');
            expect(body.name).toBe('auth-disabled');
        });

        it('does not require Authorization header', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            const res = await testApp.request('/test');
            expect(res.status).toBe(200);
        });
    });

    describe('AUTH_DISABLED not set', () => {
        beforeEach(() => {
            delete process.env.AUTH_DISABLED;
        });

        it('returns 401 without Authorization header', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            const res = await testApp.request('/test');
            expect(res.status).toBe(401);

            const body = await res.json() as { error: string; message: string };
            expect(body.error).toBe('Unauthorized');
            expect(body.message).toContain('Authorization: Bearer');
        });

        it('returns 401 with invalid Bearer token', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            const res = await testApp.request('/test', {
                headers: { Authorization: 'Bearer invalid-key' },
            });
            expect(res.status).toBe(401);
        });

        it('reads x-api-key (not Authorization) when response style is anthropic', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            // Bearer header is present but should be ignored under anthropic style
            const res = await testApp.request('/test', {
                headers: {
                    'Authorization': 'Bearer should-be-ignored',
                    'x-synapse-response-style': 'anthropic',
                },
            });
            expect(res.status).toBe(401);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('x-api-key');
            expect(body.message).toContain('anthropic');
        });

        it('infers anthropic style from x-synapse-provider when style header absent', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            const res = await testApp.request('/test', {
                headers: {
                    'Authorization': 'Bearer should-be-ignored',
                    'x-synapse-provider': 'anthropic',
                },
            });
            expect(res.status).toBe(401);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('x-api-key');
        });

        it('reads Authorization Bearer for openai style by default', async () => {
            const testApp = new Hono();
            testApp.use('/*', authMiddleware);
            testApp.get('/test', c => c.json({ ok: true }));

            const res = await testApp.request('/test', {
                headers: { 'x-api-key': 'should-be-ignored' },
            });
            expect(res.status).toBe(401);
            const body = await res.json() as { message: string };
            expect(body.message).toContain('Authorization: Bearer');
        });
    });
});
