/**
 * React Native structured logger.
 *
 * Sends logs to OTel Collector (Loki) via the /api/otel proxy.
 * Must be initialized by calling initNativeLogger() from nativeSdk.
 *
 * Usage:
 *   import { nativeLogger } from '@trinity/observability/nativeLogger';
 *   nativeLogger.info('User tapped button');
 *   nativeLogger.error('BLE connection failed');
 */
import { SeverityNumber } from '@opentelemetry/api-logs';
import type { Logger } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import type { Resource } from '@opentelemetry/resources';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

import { getNativeRequestContext } from '@trinity/observability/nativeRequestContext.js';
import type { LogAttributes } from '@trinity/observability/types.js';
import { mergeContextToAttributes } from '@trinity/observability/utils.js';

let logger: Logger | undefined;

/**
 * Initialize the native logger. Called once from startNativeOtel().
 */
export function initNativeLogger(resource: Resource, endpoint: string, serviceName: string): void {
    const exporter = new OTLPLogExporter({
        url: `${endpoint}/api/otel/v1/logs`,
    });
    const provider = new LoggerProvider({
        resource,
        processors: [new BatchLogRecordProcessor(exporter)],
    });
    logger = provider.getLogger(serviceName);
}

/**
 * Forward a log record to the OTel Collector (Loki).
 * No-ops if the logger is not yet initialized — safe during startup.
 */
export function emitLogRecord(level: number, message: string, attributes?: LogAttributes): void {
    if (!logger) return;

    // Map LogLevel numbers to OTel severity
    const SEVERITY_MAP: Record<number, { number: SeverityNumber; text: string }> = {
        0: { number: SeverityNumber.TRACE, text: 'TRACE' },
        1: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
        2: { number: SeverityNumber.INFO, text: 'INFO' },
        3: { number: SeverityNumber.WARN, text: 'WARN' },
        4: { number: SeverityNumber.ERROR, text: 'ERROR' },
    };

    const severity = SEVERITY_MAP[level];
    if (!severity) return;

    // Auto-enrich logs with native request context (enduser.id, device.id, etc.)
    const enrichedAttributes = mergeContextToAttributes(attributes, getNativeRequestContext());

    try {
        logger.emit({
            severityNumber: severity.number,
            severityText: severity.text,
            body: message,
            attributes: enrichedAttributes,
        });
    } catch {
        // Silently drop — do not disrupt the app for telemetry failures
    }
}

/**
 * Structured native logger with named severity methods.
 * No-ops before initialization — safe to use at any time.
 */
export const nativeLogger = {
    debug: (message: string, attributes?: LogAttributes) => emitLogRecord(1, message, attributes),
    info: (message: string, attributes?: LogAttributes) => emitLogRecord(2, message, attributes),
    warn: (message: string, attributes?: LogAttributes) => emitLogRecord(3, message, attributes),
    error: (message: string, attributes?: LogAttributes) => emitLogRecord(4, message, attributes),
};
