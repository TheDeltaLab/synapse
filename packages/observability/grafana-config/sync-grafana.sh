#!/bin/bash
# Sync Grafana configuration to Azure Managed Grafana.
#
# Syncs dashboards, alert rules, templates, contact points, and notification
# policies from local files to the cloud Grafana instance via API.
#
# Prerequisites:
#   - Azure CLI logged in (az login)
#   - Node.js 18+ (for native fetch)
#   - Run `pnpm install` at monorepo root
#
# Usage:
#   ./packages/observability/grafana-config/sync-grafana.sh                    # Sync to test environment
#   ./packages/observability/grafana-config/sync-grafana.sh <grafana-url>      # Sync to custom Grafana
#
# Examples:
#   ./packages/observability/grafana-config/sync-grafana.sh
#   ./packages/observability/grafana-config/sync-grafana.sh https://prod.grafana.thebrainly.dev

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAFANA_URL="${1:-https://test.grafana.thebrainly.dev}"

# Azure Managed Grafana uses this resource ID for authentication
GRAFANA_RESOURCE_ID="ce34e7e5-485f-4d76-964f-b3d2b16d1e4f"

echo "Syncing Grafana config to: $GRAFANA_URL"
echo ""

# Get Azure AD token
echo "Acquiring Azure AD token..."
TOKEN=$(az account get-access-token --resource "$GRAFANA_RESOURCE_ID" --query accessToken -o tsv 2>&1)
if [[ "$TOKEN" == *"ERROR"* ]] || [[ -z "$TOKEN" ]]; then
    echo "Error: Failed to get Azure AD token. Run 'az login' first."
    exit 0
fi
echo "Token acquired."
echo ""

# Run sync script (sync-grafana.ts is in the same directory)
npx tsx "$SCRIPT_DIR/sync-grafana.ts" "$TOKEN" "$GRAFANA_URL"
