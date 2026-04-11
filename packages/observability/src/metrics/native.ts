/**
 * Metrics for the React Native app.
 *
 * Safe wrappers — no-op before initNativeMetrics() is called.
 * Call initNativeBusinessMetrics() after initNativeMetrics() to create instruments.
 *
 * Usage:
 *   import { httpRequestDuration, errorCount } from '@trinity/observability/metrics/native';
 *
 *   httpRequestDuration.record(45, { method: 'GET', status: '200' });
 *   errorCount.add(1, { type: 'network' });
 */
import type { Meter } from '@opentelemetry/api';
import { getNativeMeter } from '@trinity/observability/nativeMetrics.js';

// ── Internal instrument references (set by init) ────────────────

type HistogramInst = ReturnType<Meter['createHistogram']>;
type CounterInst = ReturnType<Meter['createCounter']>;

let httpDuration: HistogramInst | undefined;
let httpCount: CounterInst | undefined;
let errCount: CounterInst | undefined;
let bleOpCount: CounterInst | undefined;
let startupDur: HistogramInst | undefined;

/**
 * Create business-level metric instruments from the native Meter.
 * Must be called after initNativeMetrics() in nativeSdk.ts.
 */
export function initNativeBusinessMetrics(): void {
    const meter = getNativeMeter();
    if (!meter) return;

    httpDuration = meter.createHistogram('http.client.request.duration', {
        description: 'Duration of HTTP requests from the native app',
        unit: 'ms',
    });
    httpCount = meter.createCounter('http.client.request.count', {
        description: 'Total HTTP requests from the native app',
    });
    errCount = meter.createCounter('app.error.count', {
        description: 'Total errors in the native app',
    });
    bleOpCount = meter.createCounter('ble.operation.count', {
        description: 'BLE operations in the native app',
    });
    startupDur = meter.createHistogram('app.startup.duration', {
        description: 'App startup duration',
        unit: 'ms',
    });
}

// ── Public API: Safe wrappers — no-op before init ───────────────

/** HTTP request duration. Attributes: method, status, url. */
export const httpRequestDuration = {
    record(durationMs: number, attributes: Record<string, string | number>) {
        httpDuration?.record(durationMs, attributes);
    },
};

/** HTTP request counter. Attributes: method, status, url. */
export const httpRequestCount = {
    add(value: number, attributes: Record<string, string | number>) {
        httpCount?.add(value, attributes);
    },
};

/** App error counter. Attributes: type, source. */
export const errorCount = {
    add(value: number, attributes: Record<string, string>) {
        errCount?.add(value, attributes);
    },
};

/** BLE operation counter. Attributes: operation, device_type. */
export const bleOperationCount = {
    add(value: number, attributes: Record<string, string>) {
        bleOpCount?.add(value, attributes);
    },
};

/** App startup duration (ms). */
export const appStartupDuration = {
    record(durationMs: number) {
        startupDur?.record(durationMs);
    },
};
