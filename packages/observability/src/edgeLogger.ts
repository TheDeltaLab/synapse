/**
 * Edge Runtime compatible OTel logger.
 *
 * Uses fetch() to send logs directly to OTel Collector's HTTP endpoint.
 * Batches logs in memory and flushes periodically or when batch is full.
 *
 * Usage:
 *   import { createEdgeLogger } from '@trinity/observability/edgeLogger';
 *   const edgeLogger = createEdgeLogger({ serviceName: 'trinity-home' });
 *   edgeLogger.info('Request received', { path: '/api/hello' });
 */
import type { EdgeLoggerConfig, LogAttributes } from '@trinity/observability/types.js';

interface LogRecord {
    timeUnixNano: string;
    severityNumber: number;
    severityText: string;
    body: { stringValue: string };
    attributes: Array<{ key: string; value: { stringValue: string } }>;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

const SEVERITY = {
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
} as const;

function toAttributes(attrs?: LogAttributes): Array<{ key: string; value: { stringValue: string } }> {
    if (!attrs) return [];
    return Object.entries(attrs)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
        }));
}

/**
 * Create an Edge Runtime logger instance.
 * Each call returns a separate logger with its own batch buffer.
 */
export function createEdgeLogger(config: EdgeLoggerConfig) {
    const serviceName = config.serviceName;
    const collectorUrl = config.collectorUrl || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (!collectorUrl) {
        console.warn(
            `[OTel] ⚠️ OTEL_EXPORTER_OTLP_ENDPOINT is not set for "${serviceName}". `
            + 'Edge logs will only appear in console, NOT exported to Loki.',
        );
    }

    let batch: LogRecord[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    async function flush(): Promise<void> {
        if (batch.length === 0 || !collectorUrl) return;
        const records = batch;
        batch = [];

        try {
            await fetch(`${collectorUrl}/v1/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resourceLogs: [{
                        resource: {
                            attributes: [{
                                key: 'service.name',
                                value: { stringValue: serviceName },
                            }],
                        },
                        scopeLogs: [{
                            logRecords: records,
                        }],
                    }],
                }),
            });
        } catch {
            // Silently drop on failure — Edge Runtime has no persistent retry mechanism
        }
    }

    function scheduleFlush(): void {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flush();
        }, FLUSH_INTERVAL_MS);
    }

    function emit(
        severityNumber: number,
        severityText: string,
        message: string,
        attributes?: LogAttributes,
    ): void {
        console.log(`[${severityText}]`, message, attributes ?? '');

        batch.push({
            timeUnixNano: String(Date.now() * 1_000_000),
            severityNumber,
            severityText,
            body: { stringValue: message },
            attributes: toAttributes(attributes),
        });

        if (batch.length >= BATCH_SIZE) {
            flush();
        } else {
            scheduleFlush();
        }
    }

    return {
        debug: (message: string, attributes?: LogAttributes) =>
            emit(SEVERITY.DEBUG, 'DEBUG', message, attributes),

        info: (message: string, attributes?: LogAttributes) =>
            emit(SEVERITY.INFO, 'INFO', message, attributes),

        warn: (message: string, attributes?: LogAttributes) =>
            emit(SEVERITY.WARN, 'WARN', message, attributes),

        error: (message: string, attributes?: LogAttributes) =>
            emit(SEVERITY.ERROR, 'ERROR', message, attributes),
    };
}
