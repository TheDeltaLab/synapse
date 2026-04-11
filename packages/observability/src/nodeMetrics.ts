/**
 * Node.js server-side metrics utility.
 *
 * Provides a `getMeter()` helper to create metric instruments in any Node.js app.
 * Relies on the global MeterProvider registered by startOtelSdk().
 * Metrics are exported to Mimir via OTLP and queryable with PromQL in Grafana.
 *
 * Usage (in your app's own metrics file, e.g. apps/worker/src/metrics.ts):
 *
 *   import { getMeter } from '@trinity/observability/nodeMetrics';
 *
 *   const meter = getMeter();
 *
 *   // Define app-specific metrics
 *   export const jobCounter = meter.createCounter('app.job.count', {
 *       description: 'Background job execution counter',
 *   });
 *   export const jobDuration = meter.createHistogram('app.job.duration', {
 *       description: 'Job processing duration',
 *       unit: 'ms',
 *   });
 *
 * Then in business code:
 *
 *   import { jobCounter, jobDuration } from 'trinity/metrics';
 *   jobCounter.add(1, { job: 'stt-process', status: 'success' });
 *   jobDuration.record(1234, { job: 'stt-process' });
 *
 * Grafana alert examples (PromQL):
 *   # Error rate > 100 per 5 min
 *   rate(app_error_count_total{job="web"}[5m]) * 300 > 100
 *
 *   # Error ratio > 10% on an endpoint
 *   rate(app_error_count_total{endpoint="/api/chat"}[5m])
 *     / rate(app_request_count_total{endpoint="/api/chat"}[5m]) > 0.1
 */
import { metrics } from '@opentelemetry/api';

/**
 * Get the OTel Meter for creating metric instruments.
 *
 * Call this in your app's metrics file to define app-specific counters,
 * histograms, gauges, etc. The meter name defaults to 'node'
 * but can be overridden per app.
 */
export function getMeter(name = 'node') {
    return metrics.getMeter(name);
}
