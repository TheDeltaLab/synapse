/**
 * React Native metrics SDK layer.
 *
 * Creates the MeterProvider and exposes getNativeMeter() for business metrics.
 * Business-level instruments live in metrics/native.ts.
 *
 * Usage:
 *   // SDK init (called by nativeSdk.ts):
 *   import { initNativeMetrics } from '@trinity/observability/nativeMetrics';
 *
 *   // Business metrics (used by app code):
 *   import { httpRequestDuration } from '@trinity/observability/metrics/native';
 */
import type { Meter } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import type { Resource } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const METRICS_EXPORT_INTERVAL_MS = 60_000;

let nativeMeter: Meter | undefined;

/**
 * Initialize the native MeterProvider. Called once from startNativeOtel().
 * After this call, getNativeMeter() returns the configured Meter instance.
 */
export function initNativeMetrics(resource: Resource, endpoint: string, serviceName: string): void {
    const exporter = new OTLPMetricExporter({
        url: `${endpoint}/api/otel/v1/metrics`,
    });
    const provider = new MeterProvider({
        resource,
        readers: [
            new PeriodicExportingMetricReader({
                exporter,
                exportIntervalMillis: METRICS_EXPORT_INTERVAL_MS,
            }),
        ],
    });
    nativeMeter = provider.getMeter(serviceName);
}

/**
 * Get the native Meter instance. Returns undefined before initNativeMetrics() is called.
 * Used by metrics/native.ts to create business-level instruments.
 */
export function getNativeMeter(): Meter | undefined {
    return nativeMeter;
}
