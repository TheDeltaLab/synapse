/**
 * Metrics for LanceDB services (lance API server, lance-worker).
 *
 * Instruments are LAZY (see ./lazyInstruments.ts for the why). Do not switch
 * back to eager `meter.createX()` at module top level — it will silently
 * no-op under ESM import hoisting.
 *
 * Usage:
 *   import { queryDuration, recordOpCounter } from '@trinity/observability/metrics/lance';
 *   queryDuration.record(85, { table: 'conversations', type: 'vector' });
 *   recordOpCounter.add(1, { table: 'threads', op: 'insert', status: 'success' });
 */
import { type Counter, type Histogram } from '@opentelemetry/api';
import { createLazyMeter } from '@trinity/observability/metrics/lazyInstruments.js';

const m = createLazyMeter('lance');

// ── Counters ──────────────────────────────────────────────────────

/** Record operation counter. Attributes: table, op (insert/update/delete), status (success/failed). */
export const recordOpCounter: Counter = m.counter('lance.record.op.count', {
    description: 'LanceDB record operations (insert/update/delete)',
});

/** Query counter. Attributes: table, type (vector/fts/filter/unknown), status (success/failed). */
export const queryCounter: Counter = m.counter('lance.query.count', {
    description: 'LanceDB query operations',
});

/** Sync event counter (CDC webhook). Attributes: table, status (success/failed). */
export const syncEventCounter: Counter = m.counter('lance.sync.event.count', {
    description: 'CDC sync events received from Debezium',
});

/** Index operation counter. Attributes: table, index_type (VECTOR/FTS/SCALAR), status. */
export const indexOpCounter: Counter = m.counter('lance.index.op.count', {
    description: 'LanceDB index creation operations',
});

// ── Histograms ────────────────────────────────────────────────────

/** Query duration. Attributes: table, type (vector/fts/filter). */
export const queryDuration: Histogram = m.histogram('lance.query.duration', {
    description: 'LanceDB query duration',
    unit: 'ms',
});

/** Record operation duration. Attributes: table, op (insert/update/delete). */
export const recordOpDuration: Histogram = m.histogram('lance.record.op.duration', {
    description: 'LanceDB record operation duration',
    unit: 'ms',
});
