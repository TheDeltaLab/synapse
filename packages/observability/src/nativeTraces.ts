/**
 * React Native tracing setup.
 *
 * Initializes BasicTracerProvider with manual context propagation.
 * Exports tracing utilities for business code to create custom spans.
 *
 * Usage:
 *   import { getTracer, SpanStatusCode } from '@trinity/observability/nativeTraces';
 *   const tracer = getTracer();
 *   const span = tracer.startSpan('my-operation');
 */
import { trace, context, SpanStatusCode, propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

let serviceName = '';

/**
 * Initialize native tracing. Called once from startNativeOtel().
 */
export function initNativeTraces(resource: Resource, endpoint: string, svcName: string): void {
    serviceName = svcName;
    const exporter = new OTLPTraceExporter({
        url: `${endpoint}/api/otel/v1/traces`,
    });
    const provider = new BasicTracerProvider({
        resource,
        spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    trace.setGlobalTracerProvider(provider);
}

// --- Public API ---

export function getTracer() {
    return trace.getTracer(serviceName);
}

export { trace, context, SpanStatusCode };
