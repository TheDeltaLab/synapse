import { context, propagation, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Context, Next } from 'hono';
import { GATEWAY_SERVICE_NAME } from '@synapse/shared';

/**
 * Hono middleware that creates a server span per request,
 * propagating the incoming W3C traceparent / tracestate headers.
 */
export async function traceMiddleware(c: Context, next: Next) {
    const tracer = trace.getTracer(GATEWAY_SERVICE_NAME);
    const method = c.req.method;
    const path = c.req.path;

    // Extract W3C trace context from incoming headers
    const headersCarrier: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
        headersCarrier[key] = value;
    });

    const extractedContext = propagation.extract(context.active(), headersCarrier);
    console.log('headersCarrier traceparent', headersCarrier['traceparent']);
    return tracer.startActiveSpan(
        `${method} ${path}`,
        { kind: SpanKind.SERVER },
        extractedContext,
        async (span) => {
            span.setAttribute('http.method', method);
            span.setAttribute('http.path', path);
            span.setAttribute('http.url', c.req.url);
            console.log(`Started span for ${method} ${path} traceid: ${span.spanContext().traceId}`);
            try {
                await next();

                const statusCode = c.res.status;
                span.setAttribute('http.status_code', statusCode);
                if (statusCode >= 400) {
                    span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${statusCode}` });
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                span.setStatus({ code: SpanStatusCode.ERROR, message });
                span.setAttribute('error', true);
                if (error instanceof Error) {
                    span.recordException(error);
                }
                throw error;
            } finally {
                console.log(`Ending span for ${method} ${path}`);
                span.end();
            }
        },
    );
}
