# @trinity/observability

Shared observability package for all Trinity apps. Centralizes OpenTelemetry dependencies and provides platform-specific initialization for traces, logs, and metrics.

## Service Names

Each app/runtime registers a unique `service.name` used for filtering in Grafana:

| serviceName | App | Runtime | Signal | Source |
|---|---|---|---|---|
| `home` | home | Node.js + Edge | traces, metrics, logs | `instrumentation-node.ts` + `proxy.ts` |
| `home-browser` | home | Browser | traces | `layout.tsx` (OtelWebProvider) |
| `web` | web | Node.js | traces, metrics, logs | `instrumentation-node.ts` |
| `web-browser` | web | Browser | traces | `layout.tsx` (OtelWebProvider) |
| `admin` | admin | Node.js | traces, metrics, logs | `instrumentation-node.ts` |
| `admin-browser` | admin | Browser | traces | `layout.tsx` (OtelWebProvider) |
| `worker` | worker | Node.js | traces, metrics, logs | `app.ts` |
| `lance` | lance | Node.js | traces, metrics, logs | `app.ts` |
| `lance-worker` | lance-worker | Node.js | traces, metrics, logs | `app.ts` |
| `native` | native | React Native | traces, metrics, logs | `lib/otel/index.ts` |

**Naming convention**: `{app}` for server-side, `{app}-browser` for client-side.

## Architecture

```
                        Node.js                    React Native
                   ┌──────────────┐           ┌──────────────────┐
                   │   nodeSdk    │           │    nativeSdk     │
                   │  (auto-inst) │           │   (orchestrator) │
                   └──┬───┬───┬──┘           └──┬────┬────┬────┘
                      │   │   │                 │    │    │
                      ▼   │   ▼                 ▼    │    ▼
               traces +   │  metrics    nativeTraces │  nativeMetrics
               (NodeSDK)  │  (NodeSDK)               │
                          ▼                          ▼
                    nodeLogger              nativeLogger
                          │
                          ▼
                  nodeConsolePatch

                      Browser                      Edge
                 ┌──────────────┐           ┌──────────────┐
                 │ webProvider  │           │  edgeLogger   │
                 │  (traces)    │           │  (logs only)  │
                 └──────────────┘           └──────────────┘
```

## Files

### SDK Layer

| File | Platform | Description |
|---|---|---|
| `types.ts` | All | Shared TypeScript types |
| `resource.ts` | Node + Native | OTel Resource creation (`service.name`) |
| `nodeSdk.ts` | Node.js | One-line SDK init (traces + metrics + logs) |
| `nodeLogger.ts` | Node.js | Structured logger (`nodeLogger.info/warn/error`) |
| `nodeConsolePatch.ts` | Node.js | Patches `console.*` to forward to Loki |
| `nodeMetrics.ts` | Node.js | `getMeter()` helper for creating metric instruments |
| `nativeSdk.ts` | React Native | SDK orchestrator (calls init for traces/logs/metrics) |
| `nativeTraces.ts` | React Native | Tracing setup + `getTracer()` API |
| `nativeLogger.ts` | React Native | Logger (`nativeLogger.info/warn/error`) |
| `nativeMetrics.ts` | React Native | `initNativeMetrics()` + `getNativeMeter()` |
| `webProvider.tsx` | Browser | React component for browser tracing |
| `edgeLogger.ts` | Edge Runtime | Fetch-based logger (no OTel SDK available) |

### Business Metrics (`metrics/`)

Each app has its own metrics file with domain-specific counters and histograms. Metrics are exported to Mimir via OTLP and queryable with PromQL in Grafana.

| File | Meter Name | App | Key Instruments |
|---|---|---|---|
| `metrics/worker.ts` | `worker` | worker, lance-worker | `jobCounter`, `jobDuration`, `jobQueueWaitTime` |
| `metrics/lance.ts` | `lance` | lance | `recordOpCounter`, `queryCounter`, `syncEventCounter`, `queryDuration`, `syncLatency` |
| `metrics/lance-base.ts` | `lance` | SDKs | `queryExecutionDuration` |
| `metrics/native.ts` | *(from SDK)* | native | `httpRequestDuration`, `errorCount`, `bleOperationCount`, `appStartupDuration` |

## Usage

### Node.js (Next.js / Koa)

```ts
// instrumentation-node.ts
import { startOtelSdk } from '@trinity/observability/nodeSdk';
startOtelSdk({ serviceName: 'web' });
```

```ts
// Business code
import { nodeLogger } from '@trinity/observability/nodeLogger';
nodeLogger.info('User logged in', { userId: '123' });
```

### Browser (Next.js Client)

```tsx
// layout.tsx
import { OtelWebProvider } from '@trinity/observability/webProvider';

<OtelWebProvider serviceName="web-browser">
  {children}
</OtelWebProvider>
```

### Edge Runtime

```ts
import { createEdgeLogger } from '@trinity/observability/edgeLogger';
const logger = createEdgeLogger({ serviceName: 'home' });
logger.info('Proxy request', { path: '/api/chat' });
```

### React Native

```ts
import { startNativeOtel } from '@trinity/observability/nativeSdk';
startNativeOtel({ serviceName: 'native', collectorUrl: endpoint });
```

```ts
import { nativeLogger } from '@trinity/observability/nativeLogger';
import { httpRequestDuration } from '@trinity/observability/metrics/native';
import { getTracer } from '@trinity/observability/nativeTraces';

nativeLogger.info('App started');
httpRequestDuration.record(45, { method: 'GET', status: '200' });
const span = getTracer().startSpan('ble-scan');
```

## Metrics

Metrics follow a two-layer architecture: **SDK layer** provides the meter, **business layer** defines app-specific instruments.

### Node.js

```ts
// SDK layer: getMeter() uses the global MeterProvider registered by startOtelSdk()
import { getMeter } from '@trinity/observability/nodeMetrics';
const meter = getMeter('my-app');
const myCounter = meter.createCounter('my.counter', { description: '...' });
```

Pre-built business metrics are available per app:

```ts
// Worker (auto-instrumented via ServerTaskWorker — no manual calls needed)
import { jobCounter, jobDuration } from '@trinity/observability/metrics/worker';
jobCounter.add(1, { job: 'stt-process', status: 'success' });
jobDuration.record(12340, { job: 'stt-process' });

// Lance
import { queryDuration, recordOpCounter } from '@trinity/observability/metrics/lance';
import { queryExecutionDuration } from '@trinity/observability/metrics/lance-base';
queryDuration.record(85, { table: 'conversations', type: 'vector' });
queryExecutionDuration.record(75, { table: 'conversations', type: 'vector' });
```

> **Note**: web, admin, home apps rely on OTel auto-instrumentation for HTTP metrics (traces).
> Add app-specific metrics files under `metrics/` when business-level alerting needs arise.

### React Native

Native metrics use lazy initialization with safe wrappers (no-op before SDK init):

```ts
import { httpRequestDuration, errorCount } from '@trinity/observability/metrics/native';
httpRequestDuration.record(45, { method: 'GET', status: '200' });
errorCount.add(1, { type: 'network' });
```

### Grafana / PromQL Examples

```promql
# Job failure rate by task name
rate(worker_job_count_total{status="failed"}[5m]) by (job)

# P95 job duration
histogram_quantile(0.95, rate(worker_job_duration_bucket[5m]))

# Lance query latency P99
histogram_quantile(0.99, rate(lance_query_duration_bucket{table="conversations"}[5m]))

# CDC sync failures
rate(lance_sync_event_count_total{status="failed"}[5m])
```

### TODO

- [ ] **Next.js route metrics**: `@opentelemetry/instrumentation-http` records raw URLs (e.g. `/api/conversations/abc123`) instead of route templates (`/api/conversations/[conversationId]`), causing cardinality explosion in Mimir. When metrics-based alerting is needed for web/admin/home, create a `withMetrics(handler, endpoint)` wrapper that accepts a static template path and apply selectively to key routes. Traces are unaffected (sampled, no cardinality issue).

## Configuration

| Option | Default | Description |
|---|---|---|
| `serviceName` | (required) | Identifies the service in Grafana |
| `collectorUrl` | `OTEL_EXPORTER_OTLP_ENDPOINT` or `http://localhost:4318` | OTLP HTTP endpoint |
| `enableTraces` | `true` | Enable distributed tracing |
| `enableMetrics` | `true` | Enable metrics collection |
| `enableLogs` | `true` | Enable log forwarding to Loki |
| `enableConsolePatch` | `false` | Patch `console.*` to also forward to Loki |

## Local Development

Start the observability stack:

```bash
# Option A: use the dev script (recommended)
./packages/observability/scripts/dev.sh          # start in background
./packages/observability/scripts/dev.sh logs     # start with log output
./packages/observability/scripts/dev.sh down     # stop all services
./packages/observability/scripts/dev.sh fresh    # stop, clear data, restart

# Option B: docker compose directly
cd packages/observability/docker-local
docker compose up -d
```

| Service | URL | Purpose |
|---|---|---|
| Grafana | http://localhost:3030 | Dashboards & alerting (no login required) |
| OTel Collector | http://localhost:3034 (HTTP) / :3033 (gRPC) | OTLP endpoint — all apps send data here |
| Loki | http://localhost:3031 | Log storage & query |
| Tempo | http://localhost:3032 | Trace storage & query |
| Mimir | http://localhost:3035 | Metrics storage & query (Prometheus-compatible) |

For detailed architecture, data flow, config file reference, and troubleshooting, see [docker-local/DEVELOPMENT.md](./docker-local/DEVELOPMENT.md).

## Cloud Sync

Sync local Grafana configs (dashboards, alerting, contact points) to Azure Managed Grafana:

```bash
./packages/observability/grafana-config/sync-grafana.sh                              # sync to test
./packages/observability/grafana-config/sync-grafana.sh https://prod.grafana.example  # sync to prod
```

Requires `az login`. See [grafana-config/sync-grafana.sh](./grafana-config/sync-grafana.sh) for details.

For cloud deployment history and troubleshooting, see [docker-cloud/DEPLOYMENT.md](./docker-cloud/DEPLOYMENT.md).
