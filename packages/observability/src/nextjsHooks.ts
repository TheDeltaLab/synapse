/**
 * Next.js instrumentation hooks for unified error observability.
 *
 * Provides `createOnRequestError` — a factory that returns a Next.js 15+
 * `onRequestError` hook bound to the caller's service name.
 *
 * Runtime-aware: uses `nodeLogger` (OTel SDK) in Node.js, `edgeLogger` (HTTP batch)
 * in Edge Runtime. Both deliver structured logs to OTel Collector → Loki.
 *
 * Usage in apps/web/src/instrumentation.ts:
 *   export const onRequestError = createOnRequestError({ serviceName: 'web' });
 *
 * Usage in apps/admin/src/instrumentation.ts:
 *   export const onRequestError = createOnRequestError({ serviceName: 'admin' });
 */
import type { LogAttributes } from '@trinity/observability/types.js';

/**
 * Minimal type definitions for the Next.js onRequestError hook parameters.
 * Defined here to avoid a hard dependency on `next` in the observability package.
 */
interface RequestErrorContext {
    routerKind: 'Pages Router' | 'App Router';
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
}

interface RequestInfo {
    path: string;
    method: string;
    headers: Record<string, string | undefined>;
}

export interface OnRequestErrorOptions {
    /** Service name used for OTel resource identification (e.g. 'web', 'admin'). */
    serviceName: string;
}

/** Shared interface for the subset of logger methods we need. */
interface ErrorLogger {
    error(message: string, attributes?: LogAttributes): void;
}

type OnRequestErrorHook = (
    err: unknown,
    request: RequestInfo,
    context: RequestErrorContext,
) => Promise<void>;

/**
 * Detect Node.js runtime without triggering Next.js Edge Runtime static analysis warnings.
 * Edge Runtime provides `process` but not `process.versions`, however even accessing
 * `process.versions` via optional chaining triggers the static analyzer.
 * Using globalThis avoids the direct `process` reference that trips the check.
 */
function detectNodeRuntime(): boolean {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!(globalThis as any).process?.versions?.node;
    } catch {
        return false;
    }
}

/**
 * Create a lazily-initialized logger bound to `serviceName`.
 * - Node.js: nodeLogger is a process-wide singleton (serviceName already set via `startOtelSdk`)
 * - Edge: creates one edgeLogger per serviceName, cached for the module lifecycle
 */
function createLoggerFactory(serviceName: string): () => Promise<ErrorLogger> {
    let cached: ErrorLogger | undefined;

    return async () => {
        if (cached) return cached;

        if (detectNodeRuntime()) {
            const { nodeLogger } = await import('@trinity/observability/nodeLogger.js');
            cached = nodeLogger;
        } else {
            const { createEdgeLogger } = await import('@trinity/observability/edgeLogger.js');
            cached = createEdgeLogger({ serviceName });
        }

        return cached;
    };
}

/**
 * Factory that returns a Next.js `onRequestError` instrumentation hook
 * bound to the given service name.
 *
 * The returned hook captures unhandled exceptions from all route handlers
 * (App Router & Pages Router) and logs them to OTel Collector → Loki
 * with structured attributes.
 *
 * This is the safety net: even if a route handler forgets try-catch,
 * the error will be recorded with full context for debugging.
 */
export function createOnRequestError(options: OnRequestErrorOptions): OnRequestErrorHook {
    const getLogger = createLoggerFactory(options.serviceName);

    return async (err, request, context) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;

        const logger = await getLogger();
        logger.error(`[onRequestError] Unhandled exception in ${context.routerKind} route: ${request.path}`, {
            'error.message': errorMessage,
            'error.stack': errorStack,
            'http.method': request.method,
            'http.path': request.path,
            'next.router_kind': context.routerKind,
            'next.route_type': context.routeType,
            'next.render_source': context.renderSource,
        });
    };
}
