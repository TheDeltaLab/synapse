/**
 * Node.js process-level error handlers for all Node.js apps.
 *
 * Captures `uncaughtException` and `unhandledRejection` and logs them via nodeLogger
 * so they reach OTel Collector → Loki instead of silently crashing.
 *
 * For Next.js apps, this complements `onRequestError` by catching errors that
 * escape the request lifecycle (fire-and-forget, timers, module init, etc.).
 *
 * Usage:
 *   import { registerProcessErrorHandlers } from '@trinity/observability/nodeProcessHooks';
 *   // Next.js — don't exit on uncaught (framework manages process lifecycle)
 *   registerProcessErrorHandlers({ serviceName: 'web', exitOnUncaught: false });
 *   // Standalone (Koa, BullMQ) — exit on uncaught (let K8s restart)
 *   registerProcessErrorHandlers({ serviceName: 'worker' });
 */
import { nodeLogger } from '@trinity/observability/nodeLogger.js';

export interface ProcessErrorHandlerOptions {
    /** Service name for log context (e.g. 'worker', 'web'). */
    serviceName: string;

    /**
     * Whether to exit the process after an uncaughtException.
     * Default: true — Node.js docs recommend exiting after uncaughtException
     * because the process is in an undefined state.
     * Set to false for Next.js apps where the framework manages process lifecycle.
     */
    exitOnUncaught?: boolean;
}

/**
 * Register global process error handlers that forward to nodeLogger.
 *
 * - `uncaughtException`: synchronous throws that escaped all try-catch.
 *   By default the process exits after logging (configurable via `exitOnUncaught`).
 * - `unhandledRejection`: Promise rejections with no `.catch()`.
 *   Logged but does NOT exit — Node.js >= 15 will exit on its own if --unhandled-rejections=throw.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function registerProcessErrorHandlers(options: ProcessErrorHandlerOptions): void {
    const { serviceName, exitOnUncaught = true } = options;

    // Guard against double-registration (e.g. hot reload in dev)
    if ((globalThis as Record<string, unknown>).__PROCESS_ERROR_HANDLERS_REGISTERED__) {
        return;
    }
    (globalThis as Record<string, unknown>).__PROCESS_ERROR_HANDLERS_REGISTERED__ = true;

    process.on('uncaughtException', (err: Error, origin: string) => {
        try {
            nodeLogger.error(`[uncaughtException] ${err.message}`, {
                'error.message': err.message,
                'error.stack': err.stack,
                'error.origin': origin,
                'service.name': serviceName,
            });
        } catch {
            // Last resort — if nodeLogger itself throws, fall back to raw stderr
            // to avoid infinite recursion (handler error → uncaughtException → handler → ...)
            process.stderr.write(`[uncaughtException] ${err.stack ?? err.message}\n`);
        }

        if (exitOnUncaught) {
            // Give logger time to flush before exiting
            setTimeout(() => process.exit(1), 500);
        }
    });

    process.on('unhandledRejection', (reason: unknown) => {
        const err = reason instanceof Error ? reason : new Error(String(reason));

        try {
            nodeLogger.error(`[unhandledRejection] ${err.message}`, {
                'error.message': err.message,
                'error.stack': err.stack,
                'service.name': serviceName,
            });
        } catch {
            process.stderr.write(`[unhandledRejection] ${err.stack ?? err.message}\n`);
        }
    });
}
