# Local Observability Stack

Local development environment for the Trinity observability pipeline. Uses Docker Compose to run the same components as the cloud environment.

## Architecture

```
  Trinity Apps (Node.js / Browser / React Native)
       │
       │  OTLP HTTP (:3034) / gRPC (:3033)
       ▼
  ┌─────────────────────┐
  │   OTEL Collector     │  Receives all signals, routes to backends
  └──┬───────┬───────┬──┘
     │       │       │
     ▼       ▼       ▼
  ┌─────┐ ┌─────┐ ┌─────┐
  │Loki │ │Tempo│ │Mimir│
  │:3031│ │:3032│ │:3035│
  └──┬──┘ └──┬──┘ └──┬──┘
     │       │       │
     ▼       ▼       ▼
  ┌─────────────────────┐
  │   Grafana  :3030     │  Query & visualize all signals
  └─────────────────────┘
```

## Services

| Service | Image | Host Port | Container Port | Purpose |
|---|---|---|---|---|
| OTEL Collector | `otel/opentelemetry-collector-contrib:0.120.0` | 3033 (gRPC), 3034 (HTTP) | 4317, 4318 | Receives OTLP data, routes to backends |
| Loki | `grafana/loki:3.4.2` | 3031 | 3100 | Log storage & query |
| Tempo | `grafana/tempo:2.7.2` | 3032 | 3200 | Trace storage & query |
| Mimir | `grafana/mimir:2.15.0` | 3035 | 8080 | Metrics storage & query (Prometheus-compatible) |
| Grafana | `grafana/grafana:12.4.2` | 3030 | 3000 | Dashboards, alerting, data exploration |

## Quick Start

```bash
# Start all services
./packages/observability/scripts/dev.sh

# Or directly with docker compose
cd packages/observability/docker-local
docker compose up -d
```

Open Grafana at http://localhost:3030 (no login required, auto-admin).

## OTEL Collector Pipeline

The Collector is the single entry point for all telemetry. Apps send OTLP data to port 3034 (HTTP) or 3033 (gRPC), and the Collector routes each signal to the appropriate backend:

| Signal | Pipeline | Exporter | Destination |
|---|---|---|---|
| Logs | `logs` | `otlphttp/loki` | `http://loki:3100/otlp` |
| Traces | `traces` | `otlphttp/tempo` | `http://tempo:4318` |
| Metrics | `metrics` | `otlphttp/mimir` | `http://mimir:8080/otlp` |

All pipelines also have a `debug` exporter that prints basic info to the Collector's stdout — useful for verifying data is arriving.

## Grafana Data Sources

Pre-configured via `grafana-datasources.yaml` (auto-provisioned on startup):

| Data Source | Type | URL | Features |
|---|---|---|---|
| **Loki** (default) | `loki` | `http://loki:3100` | Log → Trace linking via `trace_id` label |
| **Tempo** | `tempo` | `http://tempo:3200` | Trace → Log linking, node graph, service map |
| **Mimir** | `prometheus` | `http://mimir:8080/prometheus` | PromQL queries |

**Cross-signal linking**: Loki and Tempo are configured to link to each other. Click a `trace_id` in a log entry to jump directly to the trace in Tempo, or view related logs from a trace span.

## Grafana Provisioning

Grafana auto-loads configuration from mounted volumes:

| Mount | Source | Purpose |
|---|---|---|
| Data sources | `./grafana-datasources.yaml` | Loki, Tempo, Mimir connections |
| Dashboard provider | `./grafana-dashboards.yaml` | Points to dashboard JSON directory |
| Dashboards | `../grafana-config/dashboards/` | Dashboard JSON files |
| Alerting | `../grafana-config/alerting/alerting.yaml` | Contact points, notification policies, templates |
| Alert rules | `../grafana-config/alerting/trinity-native-alerts.yaml` | Alert rule definitions |

## Config Files

| File | Description |
|---|---|
| `docker-compose.yaml` | Service definitions, port mappings, volume mounts |
| `otel-collector-config.yaml` | OTLP receivers (gRPC + HTTP), exporters to Loki/Tempo/Mimir, pipeline routing |
| `loki-config.yaml` | Single-instance mode, filesystem storage, TSDB schema v13, structured metadata enabled |
| `tempo-config.yaml` | Local filesystem storage, OTLP receiver, metrics generator |
| `mimir-config.yaml` | Single-instance mode, filesystem storage, in-memory ring (no clustering) |
| `grafana-datasources.yaml` | Auto-provisioned data sources with cross-linking (Loki ↔ Tempo ↔ Mimir) |
| `grafana-dashboards.yaml` | Dashboard file provider pointing to `../grafana-config/dashboards/` |

## Verifying Data Flow

### Logs

```bash
# Check if logs are arriving in Loki
curl -s 'http://localhost:3031/loki/api/v1/query?query={service_name=~".%2B"}&limit=5' | jq '.data.result[].stream.service_name'
```

### Traces

```bash
# Search for recent traces in Tempo
curl -s 'http://localhost:3032/api/search?limit=5' | jq '.traces[].rootServiceName'
```

### Metrics

```bash
# Query metrics from Mimir (Prometheus-compatible API)
curl -s 'http://localhost:3035/prometheus/api/v1/label/__name__/values' | jq '.data[:10]'
```

### OTEL Collector Debug

The Collector's `debug` exporter logs all received data to stdout:

```bash
docker compose logs otel-collector --tail 20
```

## Troubleshooting

### App logs/traces not appearing in Grafana

1. **Check OTEL Collector is receiving data**: `docker compose logs otel-collector --tail 20` — look for `debug` exporter output
2. **Check the app's `OTEL_EXPORTER_OTLP_ENDPOINT`**: Should be `http://localhost:4318` (default) or `http://localhost:3034` (mapped port)
3. **Restart the app**: `BatchLogRecordProcessor` opens a connection at startup. If the Collector wasn't running when the app started, the connection is dead and won't auto-reconnect. Restart the dev server.

### Port 3034 connection refused

The Collector isn't running. Start the stack first:

```bash
./packages/observability/scripts/dev.sh
```

### Grafana shows "No data"

- Check the time range (top right) — default is "Last 1 hour"
- Verify the service name filter matches your app's `serviceName` config
- Try Explore → Loki → `{service_name=~".+"}` to see all logs regardless of filter

### Data sources show error in Grafana

The backend services (Loki/Tempo/Mimir) may still be starting up. Wait 10-20 seconds and refresh.

### Fresh start (clear all data)

```bash
./packages/observability/scripts/dev.sh fresh
```

This stops all containers (removing volumes) and starts fresh.

## Environment Variables for Apps

Trinity apps use `@trinity/observability` SDK which defaults to `http://localhost:4318` as the OTLP endpoint. Since the Collector maps host port 3034 → container port 4318, apps running on the host need:

```bash
# Default (if running app directly on host)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3034
```

The SDK code in `@trinity/observability/nodeSdk` reads this from the environment automatically. No additional config needed if the default is set.
