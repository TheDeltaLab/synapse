/**
 * Patch console.log/info/warn/error/debug to forward logs to OTel Collector (Loki).
 *
 * Must be called AFTER initOtelLogger() so _getLogger() returns a valid logger.
 * Each patched console call:
 *   1. Calls the original console method (terminal output)
 *   2. Emits a log record to Loki via the OTel logger (direct emit, not through otelLogger)
 */
import type { SeverityNumber as SeverityNumberType } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

import { _getLogger } from '@trinity/observability/nodeLogger.js';

const CONSOLE_SEVERITY: Record<string, { number: SeverityNumberType; text: string }> = {
    log: { number: SeverityNumber.INFO, text: 'INFO' },
    info: { number: SeverityNumber.INFO, text: 'INFO' },
    warn: { number: SeverityNumber.WARN, text: 'WARN' },
    error: { number: SeverityNumber.ERROR, text: 'ERROR' },
    debug: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
};

/**
 * Patch global console methods to forward to OTel Collector.
 * Safe to call multiple times — only patches once.
 */
export function patchConsole(): void {
    for (const [method, severity] of Object.entries(CONSOLE_SEVERITY)) {
        const original = (console as unknown as Record<string, (...args: unknown[]) => void>)[method].bind(console);
        (console as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
            original(...args);
            const logger = _getLogger();
            if (logger) {
                logger.emit({
                    severityNumber: severity.number,
                    severityText: severity.text,
                    body: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
                });
            }
        };
    }
}
