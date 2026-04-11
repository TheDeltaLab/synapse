/**
 * Node.js server-side OTel SDK initialization.
 *
 * One function to start traces + metrics + logs for any Node.js app (Next.js, Koa, etc.).
 *
 * Usage:
 *   import { startOtelSdk } from '@trinity/observability/nodeSdk';
 *   startOtelSdk({ serviceName: 'trinity-web', enableLogs: true });
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { patchConsole } from '@trinity/observability/nodeConsolePatch.js';
import { initOtelLogger } from '@trinity/observability/nodeLogger.js';
import { registerProcessErrorHandlers } from '@trinity/observability/nodeProcessHooks.js';
import { createResource } from '@trinity/observability/resource.js';
import type { NodeOtelConfig } from '@trinity/observability/types.js';

/**
 * Initialize the OTel NodeSDK with configurable signals.
 *
 * For Next.js apps: call inside instrumentation.ts register() behind
 *   `process.env.NEXT_RUNTIME === 'nodejs'` guard.
 * For non-Next.js apps (worker): call at top of entry point, after dotenv.
 */
export function startOtelSdk(config: NodeOtelConfig): void {
    const {
        serviceName,
        collectorUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        enableTraces = true,
        enableMetrics = true,
        enableLogs = true,
        enableConsolePatch = false,
        exitOnUncaught = true,
        serviceVersion = process.env.APP_VERSION,
        deploymentEnvironment = process.env.NODE_ENV,
    } = config;

    if (!collectorUrl) {
        console.warn(
            `[OTel] ⚠️ OTEL_EXPORTER_OTLP_ENDPOINT is not set for "${serviceName}". `
            + 'Traces, metrics, and logs will NOT be exported. '
            + 'Set the environment variable or pass collectorUrl in config.',
        );
    }

    const resource = createResource(serviceName, {
        version: serviceVersion,
        environment: deploymentEnvironment,
    });

    const sdkConfig: ConstructorParameters<typeof NodeSDK>[0] = {
        resource,
        instrumentations: [getNodeAutoInstrumentations()],
    };

    if (collectorUrl && enableTraces) {
        sdkConfig.traceExporter = new OTLPTraceExporter({
            url: `${collectorUrl}/v1/traces`,
        });
    }

    if (collectorUrl && enableMetrics) {
        sdkConfig.metricReaders = [new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
                url: `${collectorUrl}/v1/metrics`,
            }),
        })];
    }

    if (collectorUrl && enableLogs) {
        sdkConfig.logRecordProcessors = [new BatchLogRecordProcessor(
            new OTLPLogExporter({ url: `${collectorUrl}/v1/logs` }),
        )];
    }

    const sdk = new NodeSDK(sdkConfig);
    sdk.start();

    // Initialize the shared structured logger (used by otelLogger.info/warn/error)
    if (enableLogs) {
        initOtelLogger(serviceName);
    }

    // Patch console.log/warn/error to also forward to Loki
    if (enableConsolePatch && enableLogs) {
        patchConsole();
    }

    // Register process-level error handlers so uncaughtException / unhandledRejection
    // are captured via nodeLogger → Loki, instead of silently crashing.
    registerProcessErrorHandlers({ serviceName, exitOnUncaught });

    console.log(`[OTel] SDK started for ${serviceName} (traces=${enableTraces}, metrics=${enableMetrics}, logs=${enableLogs})`);

    // Fire-and-forget connectivity check — doesn't block startup, just warns if collector is unreachable.
    if (collectorUrl) {
        fetch(`${collectorUrl}/v1/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            signal: AbortSignal.timeout(5000),
        }).catch(() => {
            console.warn(
                `[OTel] ⚠️ Cannot reach collector at "${collectorUrl}" for "${serviceName}". `
                + 'Traces, metrics, and logs may not be exported. Verify OTEL_EXPORTER_OTLP_ENDPOINT is correct.',
            );
        });
    }
}
