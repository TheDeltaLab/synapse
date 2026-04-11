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

    // Only extract W3C trace context headers — avoid copying sensitive headers like authorization
    const traceHeaders: Record<string, string> = {};
    for (const key of ['traceparent', 'tracestate']) {
        const value = c.req.header(key);
        if (value) {
            traceHeaders[key] = value;
        }
    }

    const extractedContext = propagation.extract(context.active(), traceHeaders);
    return tracer.startActiveSpan(
        `${method} ${path}`,
        { kind: SpanKind.SERVER },
        extractedContext,
        async (span) => {
            span.setAttribute('http.method', method);
            span.setAttribute('http.path', path);
            span.setAttribute('http.url', c.req.url);
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
                span.end();
            }
        },
    );
}
