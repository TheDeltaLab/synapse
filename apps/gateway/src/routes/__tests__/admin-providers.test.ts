import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@synapse/dal', () => ({
    prisma: {
        apiKey: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        requestLog: { findMany: vi.fn(), count: vi.fn() },
        embeddingLog: { findMany: vi.fn(), count: vi.fn() },
    },
    decryptContent: vi.fn(),
    decryptEmbeddingInputs: vi.fn(),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.DEEPSEEK_API_KEY = 'ds-test';
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe('GET /admin/providers responseStyles', () => {
    it('returns native style only for openai', async () => {
        const { admin } = await import('../admin.js');
        const app = new Hono();
        app.route('/admin', admin);

        const res = await app.request('/admin/providers');
        const body = await res.json() as {
            providers: Array<{ id: string; responseStyles: string[]; defaultResponseStyle: string }>;
        };

        const openai = body.providers.find(p => p.id === 'openai')!;
        expect(openai.defaultResponseStyle).toBe('openai');
        expect(openai.responseStyles).toEqual(['openai']);
    });

    it('returns openai + anthropic for deepseek (compat target)', async () => {
        const { admin } = await import('../admin.js');
        const app = new Hono();
        app.route('/admin', admin);

        const res = await app.request('/admin/providers');
        const body = await res.json() as {
            providers: Array<{ id: string; responseStyles: string[]; defaultResponseStyle: string }>;
        };

        const ds = body.providers.find(p => p.id === 'deepseek')!;
        expect(ds.defaultResponseStyle).toBe('openai');
        expect(ds.responseStyles).toEqual(expect.arrayContaining(['openai', 'anthropic']));
        expect(ds.responseStyles).toHaveLength(2);
    });

    it('returns native style only for anthropic', async () => {
        process.env.ANTHROPIC_API_KEY = 'ak-test';
        const { admin } = await import('../admin.js');
        const app = new Hono();
        app.route('/admin', admin);

        const res = await app.request('/admin/providers');
        const body = await res.json() as {
            providers: Array<{ id: string; responseStyles: string[]; defaultResponseStyle: string }>;
        };

        const a = body.providers.find(p => p.id === 'anthropic')!;
        expect(a.defaultResponseStyle).toBe('anthropic');
        expect(a.responseStyles).toEqual(['anthropic']);
    });
});
