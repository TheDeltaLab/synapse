/**
 * Lazy instrument factory — defers global MeterProvider lookup until first
 * use, so module-load order doesn't matter.
 *
 * Why this exists:
 * Under ESM, metric module bodies are evaluated during the import graph
 * traversal, BEFORE NodeSDK.start() registers the real MeterProvider in the
 * app's main body. Eager `meter.createX()` at module top level therefore
 * binds to NoopMeter and silently drops every subsequent record() / add()
 * call. The OTel JS metrics API has no ProxyMeter, so the binding made at
 * createX() time is permanent. Lazy resolution dodges this by deferring
 * `metrics.getMeter().createX()` until the first record()/add() call, at
 * which point the SDK has long since registered the real MeterProvider.
 *
 * Usage:
 *   import { createLazyMeter } from '@trinity/observability/metrics/lazyInstruments.js';
 *
 *   const m = createLazyMeter('my-service');
 *   export const myCounter = m.counter('my.metric.count', { description: '...' });
 *   export const myHistogram = m.histogram('my.metric.duration', { unit: 'ms' });
 */
import {
    metrics,
    type Attributes,
    type Context,
    type Counter,
    type Histogram,
    type MetricOptions,
    type UpDownCounter,
} from '@opentelemetry/api';

/**
 * A meter-name-bound facade that creates lazy OTel instruments.
 * Mirrors the OTel native `Meter.createX()` shape.
 */
export interface LazyMeter {
    counter(name: string, options: MetricOptions): Counter;
    upDownCounter(name: string, options: MetricOptions): UpDownCounter;
    histogram(name: string, options: MetricOptions): Histogram;
}

/**
 * Bind a meter name once and get back lazy instrument factories scoped to it.
 * The actual OTel instrument behind each returned object is created on the
 * first add()/record() call, after which the resolved instance is cached.
 */
export function createLazyMeter(meterName: string): LazyMeter {
    return {
        counter(name, options) {
            let real: Counter | undefined;
            return {
                add(value: number, attributes?: Attributes, context?: Context) {
                    if (!real) {
                        real = metrics.getMeter(meterName).createCounter(name, options);
                    }
                    real.add(value, attributes, context);
                },
            };
        },
        upDownCounter(name, options) {
            let real: UpDownCounter | undefined;
            return {
                add(value: number, attributes?: Attributes, context?: Context) {
                    if (!real) {
                        real = metrics.getMeter(meterName).createUpDownCounter(name, options);
                    }
                    real.add(value, attributes, context);
                },
            };
        },
        histogram(name, options) {
            let real: Histogram | undefined;
            return {
                record(value: number, attributes?: Attributes, context?: Context) {
                    if (!real) {
                        real = metrics.getMeter(meterName).createHistogram(name, options);
                    }
                    real.record(value, attributes, context);
                },
            };
        },
    };
}
