/**
 * Request context for React Native.
 *
 * React Native lacks AsyncLocalStorage, so we use a simple module-level store.
 * This is safe in RN because there's only ONE user session at a time
 * (single-user app, no concurrent requests from different users).
 *
 * Values set here are automatically enriched into:
 * - nativeLogger log records
 * - Span attributes (via createTracedFetch in apps/native)
 *
 * Usage:
 *   import { setNativeRequestContext, getNativeRequestContext } from '@trinity/observability/nativeRequestContext';
 *
 *   // After sign-in:
 *   setNativeRequestContext({ 'enduser.id': userId });
 *
 *   // After sign-out:
 *   clearNativeRequestContext();
 */

import type { RequestContextAttributes } from '@trinity/observability/types.js';

export type { RequestContextAttributes } from '@trinity/observability/types.js';

let currentContext: RequestContextAttributes = {};

/**
 * Set attributes on the native request context.
 * Merges with any existing context (does not overwrite unrelated keys).
 *
 * Call this after user sign-in or when device identity is available.
 */
export function setNativeRequestContext(attrs: RequestContextAttributes): void {
    currentContext = { ...currentContext, ...attrs };
}

/**
 * Read the current native request context.
 * Returns empty object if nothing has been set.
 *
 * Used internally by nativeLogger to auto-enrich log records,
 * and by createTracedFetch to set span attributes.
 */
export function getNativeRequestContext(): RequestContextAttributes {
    return currentContext;
}

/**
 * Clear all context attributes.
 * Call this on sign-out to prevent stale user data from leaking into logs.
 */
export function clearNativeRequestContext(): void {
    currentContext = {};
}
