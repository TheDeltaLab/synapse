#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy.sh [options]
  -g, --resource-group   Azure resource group name
  -l, --location         Azure region
  -e, --env-name         Container Apps environment name
  -a, --app-name         Container App name
  -i, --image            Docker image to deploy
  -d, --dry-run          Print commands without executing them (default)
  -x, --execute          Run commands instead of printing
  -h, --help             Show this help message

Defaults are defined in the script and are used unless overridden by flags.
EOF
}

# Default variables (can be overridden through CLI flags)
RG="synapse-rg"
LOCATION="koreacentral"
ENV_NAME="synapse-env"
APP_NAME="synapse-gateway"
IMAGE="ghcr.io/\${GITHUB_REPOSITORY_OWNER:-local}/synapse-gateway:nightly"
DRY_RUN="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -g|--resource-group)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; exit 1; }
      RG="$2"
      shift 2
      ;;
    -l|--location)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; exit 1; }
      LOCATION="$2"
      shift 2
      ;;
    -e|--env-name)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; exit 1; }
      ENV_NAME="$2"
      shift 2
      ;;
    -a|--app-name)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; exit 1; }
      APP_NAME="$2"
      shift 2
      ;;
    -i|--image)
      [[ $# -lt 2 ]] && { echo "Missing value for $1" >&2; usage; exit 1; }
      IMAGE="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN="true"
      shift
      ;;
    -x|--execute)
      DRY_RUN="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

run_cmd() {
  echo "$*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run enabled: commands will not be executed."
else
  echo "Executing commands (dry-run disabled)."
fi

# 1. Create Resource Group
run_cmd az group create --name "$RG" --location "$LOCATION"

# 2. Create Container Apps Environment
run_cmd az containerapp env create --name "$ENV_NAME" --resource-group "$RG" --location "$LOCATION"

# 3. Create the Container App (Synapse Gateway)
run_cmd az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --image "$IMAGE" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

echo ""
echo "Deployment complete. Set environment variables with:"
echo "  az containerapp update --name $APP_NAME --resource-group $RG --set-env-vars \\"
echo "    DATABASE_URL=<your-database-url> \\"
echo "    REDIS_URL=<your-redis-url> \\"
echo "    OPENAI_API_KEY=<your-key>"
