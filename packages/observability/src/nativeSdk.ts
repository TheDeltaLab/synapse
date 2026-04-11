/**
 * React Native OTel initialization.
 *
 * Uses BasicTracerProvider (no AsyncLocalStorage) + manual context propagation.
 * Initializes traces, logs, and metrics in one call.
 *
 * Usage:
 *   import { startNativeOtel } from '@trinity/observability/nativeSdk';
 *   startNativeOtel({ serviceName: 'trinity-native', collectorUrl: endpoint });
 */
import { initNativeBusinessMetrics } from '@trinity/observability/metrics/native.js';
import { initNativeLogger } from '@trinity/observability/nativeLogger.js';
import { initNativeMetrics } from '@trinity/observability/nativeMetrics.js';
import { initNativeTraces } from '@trinity/observability/nativeTraces.js';
import { createResource } from '@trinity/observability/resource.js';
import type { NativeOtelConfig } from '@trinity/observability/types.js';

let initialized = false;

/**
 * Initialize all OTel signals (traces, logs, metrics) for a React Native app.
 * Must be called after environment/endpoint is available.
 * Failure is swallowed — telemetry init must not crash the app.
 */
export function startNativeOtel(config: NativeOtelConfig): void {
    if (initialized) return;
    initialized = true;

    try {
        const resource = createResource(config.serviceName, {
            version: config.serviceVersion,
            environment: config.deploymentEnvironment,
            platform: 'react-native',
        });
        initNativeTraces(resource, config.collectorUrl, config.serviceName);
        initNativeLogger(resource, config.collectorUrl, config.serviceName);
        initNativeMetrics(resource, config.collectorUrl, config.serviceName);
        initNativeBusinessMetrics();
        console.log(`[OTel] Native SDK started for ${config.serviceName}`);
    } catch {
        console.warn('[OTel] Failed to initialize native observability');
    }
}
