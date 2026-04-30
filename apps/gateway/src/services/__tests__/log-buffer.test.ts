import { describe, it, expect, vi, afterEach } from 'vitest';
import { LogBuffer } from '../log-buffer.js';

type RowAny = Record<string, unknown>;

type MockClient = {
    requestLog: { createMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    embeddingLog: { createMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

function makeMockClient(): MockClient {
    const requestCreateMany = vi.fn(async (_args: { data: RowAny[] }) => ({ count: _args.data.length }));
    const embeddingCreateMany = vi.fn(async (_args: { data: RowAny[] }) => ({ count: _args.data.length }));
    const requestCreate = vi.fn(async (_args: { data: RowAny }) => ({}));
    const embeddingCreate = vi.fn(async (_args: { data: RowAny }) => ({}));
    return {
        requestLog: { createMany: requestCreateMany, create: requestCreate },
        embeddingLog: { createMany: embeddingCreateMany, create: embeddingCreate },
    };
}

const baseConfig = {
    flushIntervalMs: 1000,
    flushSize: 100,
    maxQueueSize: 1000,
    maxRetries: 2,
    deadLetterFile: '/tmp/synapse-test-dead-letter.jsonl',
};

const sampleReq = (i = 0) => ({
    apiKeyId: 'k1',
    provider: 'openai',
    model: 'gpt-4o',
    statusCode: 200,
    latency: 100 + i,
});

const sampleEmb = (i = 0) => ({
    apiKeyId: 'k1',
    provider: 'openai',
    model: 'text-embedding-3-small',
    inputCount: 1,
    statusCode: 200,
    latency: 50 + i,
});

describe('LogBuffer', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not flush when both queues are empty', async () => {
        const client = makeMockClient();
        const buf = new LogBuffer(baseConfig, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        await buf.flush();
        expect(client.requestLog.createMany).not.toHaveBeenCalled();
        expect(client.embeddingLog.createMany).not.toHaveBeenCalled();
    });

    it('enqueues and flushes a single request log via createMany', async () => {
        const client = makeMockClient();
        const buf = new LogBuffer(baseConfig, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        buf.enqueueRequestLog(sampleReq() as never);
        expect(buf.size().requestLogs).toBe(1);
        await buf.flush();
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(1);
        expect(client.requestLog.createMany).toHaveBeenCalledWith({ data: [sampleReq()] });
        expect(buf.size().requestLogs).toBe(0);
    });

    it('triggers immediate flush when queue reaches flushSize', async () => {
        const client = makeMockClient();
        const buf = new LogBuffer({ ...baseConfig, flushSize: 3 }, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        buf.enqueueRequestLog(sampleReq(1) as never);
        buf.enqueueRequestLog(sampleReq(2) as never);
        buf.enqueueRequestLog(sampleReq(3) as never);
        // flush is async, give it a tick
        await new Promise(r => setImmediate(r));
        await new Promise(r => setImmediate(r));
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(1);
        const firstCall = (client.requestLog.createMany as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(firstCall?.[0].data).toHaveLength(3);
    });

    it('drops oldest when maxQueueSize is exceeded', () => {
        const client = makeMockClient();
        const buf = new LogBuffer({ ...baseConfig, maxQueueSize: 2, flushSize: 1000 }, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        buf.enqueueRequestLog(sampleReq(1) as never);
        buf.enqueueRequestLog(sampleReq(2) as never);
        buf.enqueueRequestLog(sampleReq(3) as never);
        expect(buf.size().requestLogs).toBe(2);
        expect(errSpy).toHaveBeenCalled();
    });

    it('flushAll drains both queues including items added during flush', async () => {
        const client = makeMockClient();
        const buf = new LogBuffer(baseConfig, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        buf.enqueueRequestLog(sampleReq(1) as never);
        buf.enqueueEmbeddingLog(sampleEmb(1) as never);
        await buf.flushAll();
        expect(buf.size()).toEqual({ requestLogs: 0, embeddingLogs: 0 });
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(1);
        expect(client.embeddingLog.createMany).toHaveBeenCalledTimes(1);
    });

    it('retries createMany on transient failure', async () => {
        const client = makeMockClient();
        let calls = 0;
        client.requestLog.createMany = vi.fn(async () => {
            calls++;
            if (calls < 2) throw new Error('transient');
            return { count: 1 };
        }) as never;
        const buf = new LogBuffer({ ...baseConfig, maxRetries: 3 }, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        buf.enqueueRequestLog(sampleReq() as never);
        await buf.flush();
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(2);
        errSpy.mockRestore();
    });

    it('falls back to per-row create after exhausted retries', async () => {
        const client = makeMockClient();
        client.requestLog.createMany = vi.fn(async () => {
            throw new Error('always fails');
        }) as never;
        const buf = new LogBuffer({ ...baseConfig, maxRetries: 1 }, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        buf.enqueueRequestLog(sampleReq(1) as never);
        buf.enqueueRequestLog(sampleReq(2) as never);
        await buf.flush();
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(2); // initial + 1 retry
        expect(client.requestLog.create).toHaveBeenCalledTimes(2); // per-row fallback
        errSpy.mockRestore();
    });

    it('start/stop manages the periodic flush timer', async () => {
        vi.useFakeTimers();
        const client = makeMockClient();
        const buf = new LogBuffer({ ...baseConfig, flushIntervalMs: 50 }, client as unknown as ConstructorParameters<typeof LogBuffer>[1]);
        buf.start();
        buf.enqueueRequestLog(sampleReq() as never);
        await vi.advanceTimersByTimeAsync(60);
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(1);
        buf.stop();
        buf.enqueueRequestLog(sampleReq() as never);
        await vi.advanceTimersByTimeAsync(200);
        expect(client.requestLog.createMany).toHaveBeenCalledTimes(1); // no more flushes
    });
});
