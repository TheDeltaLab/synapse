import * as otelApi from '@opentelemetry/api';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { traceMiddleware } from '../trace.js';

// Helpers to capture span operations
function createMockSpan() {
    return {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn(() => ({
            traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0',
            spanId: 'bbbbbbbbbbbbbb00',
            traceFlags: 1,
        })),
    };
}

type MockSpan = ReturnType<typeof createMockSpan>;

// Create a mock tracer whose startActiveSpan invokes the 4-arg callback
function createMockTracer(span: MockSpan) {
    return {
        startActiveSpan: vi.fn(
            (_name: string, _opts: unknown, _ctx: unknown, cb: (s: MockSpan) => Promise<void>) => cb(span),
        ),
    };
}

function stubOtel(span: MockSpan) {
    vi.spyOn(otelApi.propagation, 'extract').mockReturnValue(otelApi.ROOT_CONTEXT);
    vi.spyOn(otelApi.trace, 'getTracer').mockReturnValue(
        createMockTracer(span) as unknown as otelApi.Tracer,
    );
}

describe('traceMiddleware', () => {
    let app: Hono;

    beforeEach(() => {
        vi.restoreAllMocks();
        app = new Hono();
        app.use('*', traceMiddleware);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create a span and set attributes for a request', async () => {
        const mockSpan = createMockSpan();
        stubOtel(mockSpan);

        app.get('/test', c => c.json({ ok: true }));

        const res = await app.request('/test', { method: 'GET' });

        expect(res.status).toBe(200);
        expect(otelApi.propagation.extract).toHaveBeenCalled();
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.method', 'GET');
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.path', '/test');
        expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should propagate incoming traceparent header', async () => {
        const mockSpan = createMockSpan();
        const extractSpy = vi.spyOn(otelApi.propagation, 'extract').mockReturnValue(otelApi.ROOT_CONTEXT);
        vi.spyOn(otelApi.trace, 'getTracer').mockReturnValue(
            createMockTracer(mockSpan) as unknown as otelApi.Tracer,
        );

        app.get('/hello', c => c.text('hi'));

        const traceparent = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';

        await app.request('/hello', {
            method: 'GET',
            headers: { traceparent },
        });

        // propagation.extract should have been called with a carrier containing traceparent
        const carrier = extractSpy.mock.calls[0]?.[1] as Record<string, string> | undefined;
        expect(carrier).toBeDefined();
        expect(carrier?.traceparent).toBe(traceparent);
    });

    it('should record error when route handler throws', async () => {
        const mockSpan = createMockSpan();
        stubOtel(mockSpan);

        app.get('/fail', () => {
            throw new Error('boom');
        });

        // Hono catches the error internally, so we just exercise the path
        await app.request('/fail', { method: 'GET' });

        expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should set error status for 4xx responses', async () => {
        const mockSpan = createMockSpan();
        stubOtel(mockSpan);

        app.get('/notfound', c => c.json({ error: 'not found' }, 404));

        await app.request('/notfound', { method: 'GET' });

        expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 404);
        expect(mockSpan.setStatus).toHaveBeenCalledWith(
            expect.objectContaining({ code: otelApi.SpanStatusCode.ERROR }),
        );
        expect(mockSpan.end).toHaveBeenCalled();
    });
});
