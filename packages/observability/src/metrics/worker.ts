/**
 * Metrics for background job processors (worker, lance-worker).
 *
 * Instruments are LAZY (see ./lazyInstruments.ts for the why). Do not switch
 * back to eager `meter.createX()` at module top level — it will silently
 * no-op under ESM import hoisting.
 *
 * Usage:
 *   import { jobCounter, jobQueueWaitTime } from '@trinity/observability/metrics/worker';
 *   jobCounter.add(1, { job: 'stt-process', status: 'success' });
 *   jobQueueWaitTime.record(530, { job: 'stt-process' });
 */
import { type Counter, type Histogram } from '@opentelemetry/api';
import { createLazyMeter } from '@trinity/observability/metrics/lazyInstruments.js';

const m = createLazyMeter('worker');

// ── Counters ──────────────────────────────────────────────────────

/** Job execution counter. Attributes: job, status (success/failed/retried). */
export const jobCounter: Counter = m.counter('worker.job.count', {
    description: 'Background job execution counter',
});

// ── Histograms ────────────────────────────────────────────────────

/** Job processing duration. Attributes: job. */
export const jobDuration: Histogram = m.histogram('worker.job.duration', {
    description: 'Job processing duration',
    unit: 'ms',
});

/** Queue wait time (enqueue → processing start). Attributes: job. */
export const jobQueueWaitTime: Histogram = m.histogram('worker.job.queue_wait_time', {
    description: 'Time a job waited in queue before processing',
    unit: 'ms',
});
