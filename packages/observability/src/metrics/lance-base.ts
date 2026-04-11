/**
 * Metrics for LanceDB base operations (shared between SDKs and services).
 *
 * Instruments are LAZY (see ./lazyInstruments.ts for the why). Do not switch
 * back to eager `meter.createX()` at module top level — it will silently
 * no-op under ESM import hoisting.
 *
 * Usage:
 *   import { queryExecutionDuration } from '@trinity/observability/metrics/lance-base';
 *   queryExecutionDuration.record(85, { table: 'conversations', type: 'vector' });
 */
import { type Histogram } from '@opentelemetry/api';
import { createLazyMeter } from '@trinity/observability/metrics/lazyInstruments.js';

const m = createLazyMeter('lance');

// ── Histograms ────────────────────────────────────────────────────

/** Query execution duration (calling toArray()). Attributes: table, type (vector/fts/filter). */
export const queryExecutionDuration: Histogram = m.histogram('lance.query.execution.duration', {
    description: 'LanceDB query execution duration (toArray)',
    unit: 'ms',
});
