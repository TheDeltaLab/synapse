/**
 * Node.js structured logger for business code.
 *
 * Each call both:
 *   1. Prints to terminal (using original un-patched console, safe from double-reporting)
 *   2. Sends to OTel Collector -> Loki (for Grafana, with structured attributes)
 *
 * Usage:
 *   import { nodeLogger } from '@trinity/observability/nodeLogger';
 *   nodeLogger.info('User logged in', { userId: '123' });
 */
import { SeverityNumber, logs, type Logger } from '@opentelemetry/api-logs';

import { getRequestContext } from '@trinity/observability/nodeRequestContext.js';
import type { LogAttributes } from '@trinity/observability/types.js';
import { mergeContextToAttributes } from '@trinity/observability/utils.js';

// Save original console methods BEFORE they get patched.
// Prevents double-reporting: nodeLogger uses originals to print to terminal,
// while patched console.log separately sends to OTel.
const originalConsole = {
    debug: console.debug.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

// Use globalThis to share the logger across Turbopack/webpack module instances
declare global {
    var __OTEL_LOGGER__: Logger | undefined;
}

/**
 * Initialize the OTel logger. Called once from startOtelSdk() after sdk.start().
 *
 * Reuses the global LoggerProvider registered by NodeSDK — no duplicate exporter.
 */
export function initOtelLogger(serviceName: string): void {
    globalThis.__OTEL_LOGGER__ = logs.getLogger(serviceName);
}

function emit(
    severityNumber: SeverityNumber,
    severityText: string,
    consoleFn: (...args: unknown[]) => void,
    message: string,
    attributes?: LogAttributes,
): void {
    // Print to terminal (using original un-patched console to avoid double-reporting)
    if (attributes) {
        consoleFn(`[${severityText}]`, message, attributes);
    } else {
        consoleFn(`[${severityText}]`, message);
    }

    // Send to OTel Collector -> Loki
    // trace_id/span_id are auto-injected by OTel SDK from the active span context
    const logger = globalThis.__OTEL_LOGGER__;
    if (!logger) return;

    // Auto-enrich logs with request context attributes (set via setRequestContext).
    // This ensures Loki logs include enduser.id, request.id, etc. without manual passing.
    const enrichedAttributes = mergeContextToAttributes(attributes, getRequestContext());

    logger.emit({
        severityNumber,
        severityText,
        body: message,
        attributes: enrichedAttributes,
    });
}

/**
 * Internal: get the raw OTel logger instance.
 * Used by consolePatch to send to Loki directly without going through nodeLogger.
 */
export function _getLogger(): Logger | undefined {
    return globalThis.__OTEL_LOGGER__;
}

export const nodeLogger = {
    debug: (message: string, attributes?: LogAttributes) =>
        emit(SeverityNumber.DEBUG, 'DEBUG', originalConsole.debug, message, attributes),

    info: (message: string, attributes?: LogAttributes) =>
        emit(SeverityNumber.INFO, 'INFO', originalConsole.log, message, attributes),

    warn: (message: string, attributes?: LogAttributes) =>
        emit(SeverityNumber.WARN, 'WARN', originalConsole.warn, message, attributes),

    error: (message: string, attributes?: LogAttributes) =>
        emit(SeverityNumber.ERROR, 'ERROR', originalConsole.error, message, attributes),
};
