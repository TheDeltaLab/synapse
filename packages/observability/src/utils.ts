/**
 * Shared utility functions for the observability package.
 */
import type { Span } from '@opentelemetry/api';

import type { LogAttributes, RequestContextAttributes } from '@trinity/observability/types.js';

/**
 * Merge request context attributes into log attributes.
 * Context values are added only if:
 * - The value is not undefined
 * - The key doesn't already exist in the target attributes (caller's explicit values take priority)
 *
 * Returns the merged attributes, or the original if no context values were added.
 */
export function mergeContextToAttributes(
    attributes: LogAttributes | undefined,
    context: RequestContextAttributes | undefined,
): LogAttributes | undefined {
    if (!context) return attributes;

    const newEntries: Record<string, string> = {};
    for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && !(attributes && key in attributes)) {
            newEntries[key] = value;
        }
    }

    if (Object.keys(newEntries).length === 0) return attributes;
    return { ...newEntries, ...attributes };
}

/**
 * Set multiple attributes on an OTel span, skipping undefined values.
 */
export function setSpanAttributes(span: Span, attrs: RequestContextAttributes): void {
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) {
            span.setAttribute(key, value);
        }
    }
}
