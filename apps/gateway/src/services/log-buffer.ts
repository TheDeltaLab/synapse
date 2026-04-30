import { appendFile } from 'node:fs/promises';
import { prismaLog } from '@synapse/dal';
import type { Prisma } from '@synapse/dal/prisma/client';

type RequestLogInput = Prisma.RequestLogCreateManyInput;
type EmbeddingLogInput = Prisma.EmbeddingLogCreateManyInput;

const MAX_BACKOFF_MS = 5000;

interface LogBufferConfig {
    flushIntervalMs: number;
    flushSize: number;
    maxQueueSize: number;
    maxRetries: number;
    deadLetterFile: string;
}

const DEFAULT_CONFIG: LogBufferConfig = {
    flushIntervalMs: parseInt(process.env.LOG_BUFFER_FLUSH_MS || '1000', 10),
    flushSize: parseInt(process.env.LOG_BUFFER_FLUSH_SIZE || '100', 10),
    maxQueueSize: parseInt(process.env.LOG_BUFFER_MAX_SIZE || '10000', 10),
    maxRetries: 3,
    deadLetterFile: process.env.LOG_BUFFER_DEAD_LETTER_FILE || '.synapse-log-dead-letter.jsonl',
};

export class LogBuffer {
    private requestLogs: RequestLogInput[] = [];
    private embeddingLogs: EmbeddingLogInput[] = [];
    private timer: NodeJS.Timeout | null = null;
    private flushing = false;
    private droppedCount = 0;

    constructor(
        private readonly config: LogBufferConfig = DEFAULT_CONFIG,
        private readonly client: Pick<typeof prismaLog, 'requestLog' | 'embeddingLog'> = prismaLog,
    ) {}

    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            void this.flush();
        }, this.config.flushIntervalMs);
        this.timer.unref?.();
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    enqueueRequestLog(row: RequestLogInput): void {
        if (this.requestLogs.length >= this.config.maxQueueSize) {
            this.droppedCount++;
            console.error(
                `[LogBuffer] requestLog queue full (${this.config.maxQueueSize}), dropping oldest. Dropped total=${this.droppedCount}`,
            );
            this.requestLogs.shift();
        }
        this.requestLogs.push(row);
        if (this.requestLogs.length >= this.config.flushSize) {
            void this.flush();
        }
    }

    enqueueEmbeddingLog(row: EmbeddingLogInput): void {
        if (this.embeddingLogs.length >= this.config.maxQueueSize) {
            this.droppedCount++;
            console.error(
                `[LogBuffer] embeddingLog queue full (${this.config.maxQueueSize}), dropping oldest. Dropped total=${this.droppedCount}`,
            );
            this.embeddingLogs.shift();
        }
        this.embeddingLogs.push(row);
        if (this.embeddingLogs.length >= this.config.flushSize) {
            void this.flush();
        }
    }

    size(): { requestLogs: number; embeddingLogs: number } {
        return {
            requestLogs: this.requestLogs.length,
            embeddingLogs: this.embeddingLogs.length,
        };
    }

    async flush(): Promise<void> {
        if (this.flushing) return;
        if (this.requestLogs.length === 0 && this.embeddingLogs.length === 0) return;

        this.flushing = true;
        const reqBatch = this.requestLogs.splice(0, this.requestLogs.length);
        const embBatch = this.embeddingLogs.splice(0, this.embeddingLogs.length);

        try {
            await Promise.all([
                this.writeBatch('requestLog', reqBatch),
                this.writeBatch('embeddingLog', embBatch),
            ]);
        } finally {
            this.flushing = false;
        }
    }

    async flushAll(): Promise<void> {
        // Drain until both queues empty (handles items enqueued during flush)
        while (this.requestLogs.length > 0 || this.embeddingLogs.length > 0) {
            await this.flush();
        }
    }

    private async writeBatch(
        kind: 'requestLog' | 'embeddingLog',
        rows: (RequestLogInput | EmbeddingLogInput)[],
    ): Promise<void> {
        if (rows.length === 0) return;

        let remaining = rows;
        let lastError: unknown;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                await this.createManyByKind(kind, remaining);
                return;
            } catch (error) {
                lastError = error;
                console.error(
                    `[LogBuffer] batch ${kind} createMany failed (attempt ${attempt + 1}), falling back to per-row insert:`,
                    error,
                );
                // Per-row fallback: persist whatever rows succeed individually,
                // carry the still-failing rows into the next retry round.
                remaining = await this.insertPerRow(kind, remaining);
                if (remaining.length === 0) return;
                if (attempt < this.config.maxRetries) {
                    const backoffMs = Math.min(100 * Math.pow(2, attempt), MAX_BACKOFF_MS);
                    await sleep(backoffMs);
                }
            }
        }

        // Retries exhausted: dump anything still failing to the dead-letter file.
        console.error(
            `[LogBuffer] ${remaining.length} ${kind} rows still failing after ${this.config.maxRetries + 1} attempts; sending to dead-letter`,
        );
        for (const row of remaining) {
            await this.writeDeadLetter(kind, row, lastError);
        }
    }

    private async createManyByKind(
        kind: 'requestLog' | 'embeddingLog',
        rows: (RequestLogInput | EmbeddingLogInput)[],
    ): Promise<void> {
        if (kind === 'requestLog') {
            await this.client.requestLog.createMany({ data: rows as RequestLogInput[] });
        } else if (kind === 'embeddingLog') {
            await this.client.embeddingLog.createMany({ data: rows as EmbeddingLogInput[] });
        } else {
            assertNever(kind);
        }
    }

    private async insertPerRow(
        kind: 'requestLog' | 'embeddingLog',
        rows: (RequestLogInput | EmbeddingLogInput)[],
    ): Promise<(RequestLogInput | EmbeddingLogInput)[]> {
        const stillFailing: (RequestLogInput | EmbeddingLogInput)[] = [];
        for (const row of rows) {
            try {
                if (kind === 'requestLog') {
                    await this.client.requestLog.create({ data: row as RequestLogInput });
                } else if (kind === 'embeddingLog') {
                    await this.client.embeddingLog.create({ data: row as EmbeddingLogInput });
                } else {
                    assertNever(kind);
                }
            } catch {
                stillFailing.push(row);
            }
        }
        return stillFailing;
    }

    private async writeDeadLetter(
        kind: string,
        row: RequestLogInput | EmbeddingLogInput,
        error: unknown,
    ): Promise<void> {
        try {
            const entry = {
                ts: new Date().toISOString(),
                kind,
                error: error instanceof Error ? error.message : String(error),
                row: serializeRow(row),
            };
            await appendFile(this.config.deadLetterFile, JSON.stringify(entry) + '\n');
        } catch (writeErr) {
            console.error('[LogBuffer] dead-letter write failed:', writeErr);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function assertNever(value: never): never {
    throw new Error(`Unhandled log kind: ${String(value)}`);
}

// Bytes fields cannot be JSON-stringified directly; convert to base64 for the dead-letter file.
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        if (value instanceof Uint8Array) {
            out[key] = { __bytes: Buffer.from(value).toString('base64') };
        } else {
            out[key] = value;
        }
    }
    return out;
}

// Singleton used by the proxy route. Tests can instantiate their own LogBuffer.
export const logBuffer = new LogBuffer();
