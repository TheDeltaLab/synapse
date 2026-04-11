#!/bin/bash
# Start the local observability stack (Grafana + Loki + Tempo + Mimir + OTEL Collector)
#
# Usage:
#   ./packages/observability/scripts/dev.sh          # Start in background
#   ./packages/observability/scripts/dev.sh logs     # Start and follow logs
#   ./packages/observability/scripts/dev.sh down     # Stop all services
#   ./packages/observability/scripts/dev.sh fresh    # Stop, clear data, and start fresh
#
# After starting:
#   Grafana:        http://localhost:3030  (no login required)
#   Loki:           http://localhost:3031
#   Tempo:          http://localhost:3032
#   Mimir:          http://localhost:3035
#   OTEL Collector: http://localhost:3034  (OTLP HTTP)
#                   grpc://localhost:3033  (OTLP gRPC)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-local/docker-compose.yaml"

case "${1:-up}" in
    up)
        docker compose -f "$COMPOSE_FILE" up -d
        echo ""
        echo "Observability stack started:"
        echo "  Grafana:        http://localhost:3030"
        echo "  Loki:           http://localhost:3031"
        echo "  Tempo:          http://localhost:3032"
        echo "  Mimir:          http://localhost:3035"
        echo "  OTEL Collector: http://localhost:3034 (HTTP) / localhost:3033 (gRPC)"
        ;;
    logs)
        docker compose -f "$COMPOSE_FILE" up
        ;;
    down)
        docker compose -f "$COMPOSE_FILE" down
        echo "Observability stack stopped."
        ;;
    fresh)
        docker compose -f "$COMPOSE_FILE" down
        docker compose -f "$COMPOSE_FILE" up -d
        echo ""
        echo "Observability stack started fresh (data cleared):"
        echo "  Grafana:        http://localhost:3030"
        echo "  Loki:           http://localhost:3031"
        echo "  Tempo:          http://localhost:3032"
        echo "  Mimir:          http://localhost:3035"
        echo "  OTEL Collector: http://localhost:3034 (HTTP) / localhost:3033 (gRPC)"
        ;;
    *)
        echo "Usage: $0 [up|logs|down|fresh]"
        exit 1
        ;;
esac
