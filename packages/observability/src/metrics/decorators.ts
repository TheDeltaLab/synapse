/**
 * Metrics decorators.
 */
import { type Attributes, type Histogram } from '@opentelemetry/api';

/**
 * A decorator that records the execution time of a method to a Histogram.
 *
 * It automatically adds 'method' and 'status' (success/error) attributes.
 *
 * @param histogram The Histogram instrument to record to.
 * @param attributes Optional static attributes to include with the metric.
 *
 * Usage:
 *   import { Timed } from '@trinity/observability/metrics/decorators';
 *   import { myHistogram } from '@trinity/observability/metrics/my-service';
 *
 *   class MyService {
 *     @Timed(myHistogram, { operation: 'process' })
 *     async doSomething() { ... }
 *   }
 */
export function Timed(histogram: Histogram, attributes?: Attributes): MethodDecorator {
    return function (
        _target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;
        if (typeof originalMethod !== 'function') {
            return;
        }

        const methodName = String(propertyKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        descriptor.value = function (this: any, ...args: any[]) {
            const start = performance.now();

            const record = (status: 'success' | 'error') => {
                const duration = performance.now() - start;
                histogram.record(duration, {
                    ...attributes,
                    method: methodName,
                    status,
                });
            };

            try {
                const result = originalMethod.apply(this, args);

                if (result instanceof Promise) {
                    return result
                        .then((value) => {
                            record('success');
                            return value;
                        })
                        .catch((error: unknown) => {
                            record('error');
                            throw error;
                        });
                }

                record('success');
                return result;
            } catch (error) {
                record('error');
                throw error;
            }
        };

        return descriptor;
    };
}
