#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy.sh [options]
  -g, --resource-group   Azure resource group name
  -l, --location         Azure region
  -e, --env-name         Container Apps environment name
  -a, --app-name         Container App name
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
APP_NAME="synapse-test"
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
  --image portkeyai/gateway:latest \
  --target-port 8787 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.25 --memory 0.5Gi

# 4. Create the Container App with a System-Assigned Identity
# We start with a public image as a placeholder
#run_cmd az containerapp create \
#  --name $APP_NAME \
#  --resource-group $RG \
#  --environment $ENV_NAME \
#  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
#  --target-port 8787 \
#  --ingress external \
#  --system-assigned

# 5. Grant the App permission to pull from your new ACR (Managed Identity)
#PRINCIPAL_ID=$(az containerapp identity show --name $APP_NAME --resource-group $RG --query principalId --output tsv)
#run_cmd az role assignment create --assignee $PRINCIPAL_ID --role "AcrPull" --scope $ACR_ID