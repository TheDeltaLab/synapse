/**
 * Request-scoped context store for Node.js servers.
 *
 * Provides a generic key-value store scoped to the current async context
 * (request lifecycle). Values set here are automatically:
 * - Injected into OTel span attributes (traces)
 * - Enriched into nodeLogger log records (logs)
 *
 * Uses AsyncLocalStorage under the hood — same mechanism as OTel Context.
 *
 * Usage:
 *   import { setRequestContext, getRequestContext } from '@trinity/observability/nodeRequestContext';
 *
 *   // In middleware (after auth):
 *   setRequestContext({ 'enduser.id': userId, 'request.id': requestId });
 *
 *   // In business code — no manual passing needed:
 *   nodeLogger.info('Processing order');  // auto-enriched with enduser.id, request.id
 *
 * Supported keys (OTel semantic conventions):
 *   - enduser.id       — authenticated user ID
 *   - request.id       — unique request identifier
 *   - device.id        — client device identifier
 *   - conversation.id  — business context
 *   - Any string key   — extensible for future needs
 *
 * NOTE: Node.js only (AsyncLocalStorage). Not available in Edge Runtime or React Native.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { trace } from '@opentelemetry/api';

import type { RequestContextAttributes } from '@trinity/observability/types.js';
import { setSpanAttributes } from '@trinity/observability/utils.js';

export type { RequestContextAttributes } from '@trinity/observability/types.js';

const requestContextStorage = new AsyncLocalStorage<RequestContextAttributes>();

/**
 * Set attributes on the current request context.
 *
 * Merges with any existing context (does not overwrite unrelated keys).
 * Also sets attributes on the active OTel span for trace visibility.
 *
 * Call this in middleware after authentication or at the start of a job processor.
 * All subsequent nodeLogger calls within the same async context will auto-include
 * these attributes in log records.
 */
export function setRequestContext(attrs: RequestContextAttributes): void {
    // Merge with existing context (if any)
    const existing = requestContextStorage.getStore() ?? {};
    const merged = { ...existing, ...attrs };
    requestContextStorage.enterWith(merged);

    // Also set on active OTel span for trace visibility
    const span = trace.getActiveSpan();
    if (span) {
        setSpanAttributes(span, attrs);
    }
}

/**
 * Read the current request context attributes.
 * Returns undefined if called outside a request scope.
 *
 * Used internally by nodeLogger to auto-enrich log records.
 * Can also be used in business code to access context values.
 */
export function getRequestContext(): RequestContextAttributes | undefined {
    return requestContextStorage.getStore();
}
