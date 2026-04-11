# Observability Cloud Deployment Log

Date: 2026-03-19 ~ 2026-03-20

## Deployment Summary

| Step | Resource | Status | Notes |
|------|----------|--------|-------|
| 1. Storage Account | `deltatestkrcstorage` | ✅ Succeeded | Merlin deployed, `loki-chunks` container created |
| 2. Docker images push | `trinity/loki:nightly`, `trinity/otel:nightly` | ✅ Succeeded | Rebuilt as amd64 + Loki expand-env fix, pushed to ACR |
| 3. Loki Container App | `trinity-loki-test-krc-aca` | ✅ Running | Started successfully after arch fix + expand-env fix |
| 4. OTEL Collector Container App | `trinity-otel-test-krc-aca` | ✅ Running | Started successfully |
| 5. ACR Role Assignment | Both apps | ✅ Already assigned | Auto-assigned despite permission error on user account |
| 6. Connect Collector → Loki | `LOKI_ENDPOINT` | ✅ Set | HTTPS internal FQDN |
| 7. Loki external + IP whitelist | ingress | ✅ Done | External for Grafana, IP whitelist (Grafana IPs only) |
| 8. Grafana → Loki data source | `trinity-grafana` | ✅ Connected | Azure Managed Grafana, Loki data source added |
| 9. End-to-end verification | test log | ✅ Passed | `Hello from cloud OTEL!` visible in Grafana |
| 10. Connect Apps → Collector | - | ❌ Not started | Need to set `OTEL_EXPORTER_OTLP_ENDPOINT` on home |

## Current Blocker

**ACR Role Assignment** — both Container Apps need `AcrPull` role on the ACR to pull images. Current user (`weil@thebrainly.ai`) lacks `Microsoft.Authorization/roleAssignments/write` permission. Need someone with **Owner** or **User Access Administrator** role to run:

```bash
# OTEL Collector (principal ID: 90ed13a7-c9ce-4fe3-979e-da5d2974d29b)
az role assignment create \
  --assignee 90ed13a7-c9ce-4fe3-979e-da5d2974d29b \
  --scope /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.ContainerRegistry/registries/deltasharedtestkrcacr \
  --role acrpull

# Loki (principal ID: 26c9bb29-02eb-4f1d-bb4f-f0ef7ea8aba9)
az role assignment create \
  --assignee 26c9bb29-02eb-4f1d-bb4f-f0ef7ea8aba9 \
  --scope /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.ContainerRegistry/registries/deltasharedtestkrcacr \
  --role acrpull
```

After ACR roles are assigned, resume from **"Steps to Resume"** section below.

## Steps to Resume (after ACR roles are assigned)

```bash
# 1. Update Loki with amd64 image + storage secret env var
az containerapp update \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --image deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  --set-env-vars \
    "AZURE_STORAGE_ACCOUNT_NAME=deltatestkrcstorage" \
    "AZURE_STORAGE_ACCOUNT_KEY=secretref:azure-storage-key" \
    "AZURE_STORAGE_CONTAINER_NAME=loki-chunks"

# 2. Update OTEL Collector with amd64 image (trigger new revision to pull image with ACR role)
az containerapp update \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --image deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly

# 3. Get CAE default domain
CAE_DOMAIN=$(az containerapp env show \
  --name delta-shared-test-krc-cae \
  --resource-group delta-shared-test-krc-rg \
  --query 'properties.defaultDomain' -o tsv)
echo "CAE Domain: $CAE_DOMAIN"

# 4. Set LOKI_ENDPOINT on OTEL Collector
az containerapp update \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --set-env-vars "LOKI_ENDPOINT=http://trinity-loki-test-krc-aca.internal.${CAE_DOMAIN}/otlp"

# 5. Verify Loki is healthy
az containerapp logs show \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --type console

# 6. Verify OTEL Collector is healthy
az containerapp logs show \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --type console

# 7. Add OTEL endpoint to app configs and redeploy (via Merlin or az CLI)
# OTEL_EXPORTER_OTLP_ENDPOINT=http://trinity-otel-test-krc-aca.internal.${CAE_DOMAIN}
```

## What Was Done

### 1. Merlin Infrastructure Extensions

Extended Merlin CLI to support observability resources:

- **schema.ts**: Added `ingressMode`, `enableHealthProbes`, `healthProbePath` to ACA schema; added `StorageConfigSchema`
- **parameters.ts**: Extended ACA builder with new params + env vars/secrets handling; added `buildStorageParameters()`
- **aca.bicep**: Forwards `ingressMode`, `enableHealthProbes`, `healthProbePath`, `secrets` to container-app module
- **naming.ts**: Added `omitSharedSegment: true` for storage type (24-char limit)
- **New Bicep modules**: `storage-account.bicep`, `shared/storage.bicep`

### 2. Cloud Configs & Dockerfiles

Created `packages/observability/docker-cloud/`:

- `otel-collector-config.yaml` — OTEL Collector config with `${env:LOKI_ENDPOINT}` placeholder
- `loki-config.yaml` — Loki config with Azure Blob Storage backend
- `Dockerfile.otel-collector` — Bakes config into `otel/opentelemetry-collector-contrib:0.120.0`
- `Dockerfile.loki` — Bakes config into `grafana/loki:3.4.2`

Local image build verification:
```bash
docker build -f packages/observability/docker-cloud/Dockerfile.otel-collector packages/observability/docker-cloud/ -t trinity-otel:test
docker build -f packages/observability/docker-cloud/Dockerfile.loki packages/observability/docker-cloud/ -t trinity-loki:test
```

### 3. infra.yaml Updates

- Added `shared.storage` (Storage Account)
- Added `apps.otel` (OTEL Collector, internal ACA)
- Added `apps.loki` (Loki, internal ACA)

### 4. CI/CD Updates

- `docker-build-push/action.yml`: Added `dockerfile` and `build_context` optional inputs
- `docker-publish.yml`: Added `otel` and `loki` to DOCKER_APPS, path filters, and docker-config resolution

### 5. Merlin Build & Verification

```bash
cd packages/merlin && pnpm build
pnpm dev -l -r test  # Verified resource names: otel, loki, storage all listed correctly
```

### 6. Docker Images Build & Push to ACR

```bash
# Login to ACR
az acr login --name deltasharedtestkrcacr

# Build and push Loki image
docker build -f packages/observability/docker-cloud/Dockerfile.loki \
  -t deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  packages/observability/docker-cloud/
docker push deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly

# Build and push OTEL Collector image
docker build -f packages/observability/docker-cloud/Dockerfile.otel-collector \
  -t deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly \
  packages/observability/docker-cloud/
docker push deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly
```

### 7. Storage Account Deployment

```bash
# Deployed via Merlin — succeeded
cd packages/merlin && pnpm dev -s storage -r test --execute --yes
```

Created:
- Storage Account: `deltatestkrcstorage` in `delta-shared-test-krc-rg`
- Blob Container: `loki-chunks`
- Storage Key: retrieved via `az storage account keys list`

### 8. Container App Deployments

Merlin Bicep deployment hit chicken-and-egg issues (see Problems below), switched to direct `az containerapp create`:

```bash
# OTEL Collector — succeeded (minus role assignment)
az containerapp create \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --environment /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.App/managedEnvironments/delta-shared-test-krc-cae \
  --image deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly \
  --registry-server deltasharedtestkrcacr.azurecr.io \
  --registry-identity system \
  --cpu 0.5 --memory 1.0Gi \
  --ingress internal --target-port 4318

# Loki — created, setting secrets in progress
az containerapp create \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --environment /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.App/managedEnvironments/delta-shared-test-krc-cae \
  --image deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  --registry-server deltasharedtestkrcacr.azurecr.io \
  --registry-identity system \
  --cpu 0.5 --memory 1.0Gi \
  --ingress internal --target-port 3100 \
  --secrets "azure-storage-key=<STORAGE_KEY>" \
  --env-vars "AZURE_STORAGE_ACCOUNT_NAME=deltatestkrcstorage" \
             "AZURE_STORAGE_ACCOUNT_KEY=secretref:azure-storage-key" \
             "AZURE_STORAGE_CONTAINER_NAME=loki-chunks"
```

### 9. Architecture Fix & Redeploy

First deploy used arm64 images (built on Apple Silicon Mac), but Azure Container Apps requires amd64.

**Before (broken):**
```bash
# Default build on ARM Mac → produces arm64 images
docker build -f packages/observability/docker-cloud/Dockerfile.loki \
  -t deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  packages/observability/docker-cloud/
# docker inspect → Architecture: arm64 ❌
```

**Fix — Dockerfile change:**
```dockerfile
# Before (takes host architecture):
FROM grafana/loki:3.4.2

# After (always amd64, works on any build machine):
FROM --platform=linux/amd64 grafana/loki:3.4.2
```

Same fix applied to `Dockerfile.otel-collector`.

**After (fixed):**
```bash
# Rebuild with platform flag (Dockerfile now enforces amd64)
docker build --platform linux/amd64 \
  -f packages/observability/docker-cloud/Dockerfile.loki \
  -t deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  packages/observability/docker-cloud/
# docker inspect → Architecture: amd64 ✅

docker build --platform linux/amd64 \
  -f packages/observability/docker-cloud/Dockerfile.otel-collector \
  -t deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly \
  packages/observability/docker-cloud/

# Push both
docker push deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly
docker push deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly

# Update Container Apps to pull new images
az containerapp update \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --image deltasharedtestkrcacr.azurecr.io/trinity/loki:nightly \
  --set-env-vars \
    "AZURE_STORAGE_ACCOUNT_NAME=deltatestkrcstorage" \
    "AZURE_STORAGE_ACCOUNT_KEY=secretref:azure-storage-key" \
    "AZURE_STORAGE_CONTAINER_NAME=loki-chunks"

az containerapp update \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --image deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly
```

**How to verify image architecture:**
```bash
# Local check
docker inspect <image> --format '{{.Architecture}}'

# ACR check
az acr manifest list-metadata --registry deltasharedtestkrcacr --name trinity/loki

# Container App logs (if architecture wrong, shows "exec format error")
az containerapp logs show --name <app> --resource-group <rg> --type console
```

### 10. Switch to Alpine Base Images (sh + bash support)

Official images (scratch/distroless) have no shell — cannot use Azure Portal console to exec into containers.
Switched both Dockerfiles to multi-stage builds: extract binary from official image, use Alpine as final base.

**Before (no shell):**
```dockerfile
# OTEL Collector — scratch image, no sh/bash
FROM --platform=linux/amd64 otel/opentelemetry-collector-contrib:0.120.0
COPY otel-collector-config.yaml /etc/otelcol-contrib/config.yaml

# Loki — busybox-based, sh at non-standard path, no bash, no apk
FROM --platform=linux/amd64 grafana/loki:3.4.2
COPY loki-config.yaml /etc/loki/local-config.yaml
```

**After (Alpine with sh + bash):**
```dockerfile
# OTEL Collector — Alpine base with bash
FROM --platform=linux/amd64 otel/opentelemetry-collector-contrib:0.120.0 AS collector
FROM --platform=linux/amd64 alpine:3.21
RUN apk add --no-cache bash ca-certificates
COPY --from=collector /otelcol-contrib /otelcol-contrib
COPY otel-collector-config.yaml /etc/otelcol-contrib/config.yaml
ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config", "/etc/otelcol-contrib/config.yaml"]

# Loki — Alpine base with bash
FROM --platform=linux/amd64 grafana/loki:3.4.2 AS loki
FROM --platform=linux/amd64 alpine:3.21
RUN apk add --no-cache bash ca-certificates
COPY --from=loki /usr/bin/loki /usr/bin/loki
COPY loki-config.yaml /etc/loki/local-config.yaml
ENTRYPOINT ["/usr/bin/loki"]
CMD ["-config.file=/etc/loki/local-config.yaml", "-config.expand-env=true"]
```

**Verification:**
```bash
# Verify binaries work
docker run --rm --platform linux/amd64 --entrypoint /otelcol-contrib trinity-otel:test --version
# → otelcol-contrib version 0.120.1

docker run --rm --platform linux/amd64 --entrypoint /usr/bin/loki trinity-loki:test -version
# → loki, version 3.4.2, platform: linux/amd64

# Verify sh + bash available
docker run --rm --platform linux/amd64 --entrypoint sh trinity-otel:test -c "echo sh-ok && bash -c 'echo bash-ok'"
# → sh-ok
# → bash-ok
```

**Note on tag caching:** Azure Container Apps caches images by tag. When pushing with the same `:nightly` tag, use a different tag (e.g., `:nightly-v2`) to force Azure to pull the new image. See P9 for details.

### 11. Loki Secret Setup

The initial `az containerapp create` for Loki included `--secrets`, but the secret value needed to be re-set after the architecture fix:

```bash
# Get storage key
STORAGE_KEY=$(az storage account keys list \
  --account-name deltatestkrcstorage \
  --resource-group delta-shared-test-krc-rg \
  --query '[0].value' -o tsv)

# Set secret on Loki Container App
az containerapp secret set \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --secrets "azure-storage-key=$STORAGE_KEY"

# IMPORTANT: Must restart for secret changes to take effect
az containerapp revision restart \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --revision <active-revision-name>
```

### 12. Set minReplicas to Prevent Scale-to-Zero

Both services need to always be running (waiting for incoming data). Without `minReplicas=1`, Azure scales them to zero when idle, causing `ActivationFailed` errors.

```bash
az containerapp update --name trinity-loki-test-krc-aca --resource-group trinity-loki-test-krc-rg --min-replicas 1
az containerapp update --name trinity-otel-test-krc-aca --resource-group trinity-otel-test-krc-rg --min-replicas 1
```

### 13. Connect OTEL Collector → Loki

Set `LOKI_ENDPOINT` on Collector. **Important**: Use `https://` (not `http://`) — Container Apps internal ingress uses HTTPS on port 443. See P10 for details.

```bash
# Get CAE default domain
CAE_DOMAIN=$(az containerapp env show \
  --name delta-shared-test-krc-cae \
  --resource-group delta-shared-test-krc-rg \
  --query 'properties.defaultDomain' -o tsv)

# Set LOKI_ENDPOINT (HTTPS, no port number)
az containerapp update \
  --name trinity-otel-test-krc-aca \
  --resource-group trinity-otel-test-krc-rg \
  --set-env-vars "LOKI_ENDPOINT=https://trinity-loki-test-krc-aca.internal.${CAE_DOMAIN}/otlp"
```

### 14. Loki External Ingress + IP Whitelist (for Grafana)

Azure Managed Grafana (`trinity-grafana`) cannot access Loki's internal ingress (not in same VNet). Changed Loki to external ingress with IP whitelist restricting access to Grafana's outbound IPs only.

```bash
# Change Loki to external ingress
az containerapp ingress update \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --type external

# Get Grafana outbound IPs
az grafana show --name trinity-grafana --resource-group DevOps-RG --query 'properties.outboundIPs' -o json
# → ["20.249.48.4", "20.214.216.216"]

# Add IP whitelist (only Grafana IPs allowed, all others denied)
az containerapp ingress access-restriction set \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --rule-name grafana-ip-1 --ip-address 20.249.48.4/32 --action Allow

az containerapp ingress access-restriction set \
  --name trinity-loki-test-krc-aca \
  --resource-group trinity-loki-test-krc-rg \
  --rule-name grafana-ip-2 --ip-address 20.214.216.216/32 --action Allow
```

**Note**: CAE internal traffic (Collector → Loki) is not affected by IP whitelist — internal traffic bypasses ingress access restrictions.

### 15. Grafana Data Source Configuration

Added Loki as data source in Azure Managed Grafana:

1. Open `https://trinity-grafana-bpc6gfcehqgbc3eu.sel.grafana.azure.com`
2. **Connections** → **Data sources** → **Add data source** → select **Loki**
3. URL: `https://trinity-loki-test-krc-aca.wittyriver-dea6278d.koreacentral.azurecontainerapps.io`
   - Note: external URL (no `.internal.`), no port number
4. Authentication: **No Authentication**
5. **Save & test** → `Data source successfully connected`

### 16. End-to-End Verification via Grafana

Verified full pipeline: test log → OTEL Collector → Loki → Grafana query

1. Sent test log via OTEL Collector console (see End-to-End Verification section)
2. In Grafana **Explore** → select **loki** data source
3. Query: `{service_name="test-cloud"}`
4. Result: `2026-03-20 14:56:24.000  Hello from cloud OTEL!` ✅

---

## Problems Encountered

### P1: Bicep binary architecture mismatch

**Symptom**: `Exec format error: '/Users/geeknull/.azure/bin/bicep'`
**Cause**: Bicep binary was wrong architecture (x86 on ARM Mac)
**Fix**: `rm ~/.azure/bin/bicep && az bicep install` → reinstalled v0.41.2

### P2: Chicken-and-egg with secretRef on initial deploy

**Symptom**: `ContainerAppSecretRefNotFound` — Bicep deployment failed because `secretRef: "azure-storage-key"` referenced a secret that didn't exist yet (Container App not created).
**Cause**: Merlin's parameter builder tries to read existing secrets from the Container App via `az containerapp secret show`. On initial deploy, the app doesn't exist, so the secret is skipped. But Bicep then fails because `secretRef` in env vars requires the secret to be in `configuration.secrets`.
**Workaround**: Used `az containerapp create` directly with `--secrets` flag to set secrets and env vars in one step.
**TODO**: Improve Merlin to handle initial deploys with secrets — see TODO section.

### P3: Loki health probe timeout

**Symptom**: `Failed to provision revision... Operation expired.` after ~20 minutes
**Cause**: Loki deployed without storage key → couldn't connect to Azure Blob Storage → `/ready` health check failed → Azure waited until timeout
**Fix**: Disabled health probes for initial deploy, then set secrets afterward

### P4: Deployment stuck in InProgress

**Symptom**: After failed Bicep deployments, `provisioningState: InProgress` lasted ~20 minutes, blocking new operations with `ContainerAppOperationInProgress` error
**Cause**: Azure was still trying to stabilize the failed revision
**Fix**: Had to wait for the operation to complete/fail before retrying

### P5: ACR role assignment permission denied

**Symptom**: `AuthorizationFailed... does not have authorization to perform action 'Microsoft.Authorization/roleAssignments/write'`
**Cause**: Current user (`weil@thebrainly.ai`) doesn't have Owner or User Access Administrator role on the ACR's resource group
**Fix needed**: Someone with Owner permission needs to run:
```bash
az role assignment create \
  --assignee 90ed13a7-c9ce-4fe3-979e-da5d2974d29b \
  --scope /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.ContainerRegistry/registries/deltasharedtestkrcacr \
  --role acrpull
```
**Note**: Loki's Container App was created via Bicep (which handled role assignment differently), so it may or may not have ACR pull permission. Check and fix if needed:
```bash
# Check Loki's principal ID
az containerapp show --name trinity-loki-test-krc-aca --resource-group trinity-loki-test-krc-rg --query 'identity.principalId' -o tsv

# Assign AcrPull if missing
az role assignment create \
  --assignee <loki-principal-id> \
  --scope /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/delta-shared-test-krc-rg/providers/Microsoft.ContainerRegistry/registries/deltasharedtestkrcacr \
  --role acrpull
```

### P6: Docker image architecture mismatch (arm64 vs amd64)

**Symptom**: Container App deployment timed out (`Operation expired`), containers kept restarting
**Cause**: Docker images built on Apple Silicon Mac defaulted to arm64, but Azure Container Apps runs linux/amd64. The container failed with `exec format error` on startup.
**How we found it**: `docker inspect <image> --format '{{.Architecture}}'` showed `arm64`
**Fix**: Added `FROM --platform=linux/amd64` to both Dockerfiles; rebuilt and pushed amd64 images
**Prevention**: Always use `FROM --platform=linux/amd64` in Dockerfiles for cloud deployment. CI/CD (ubuntu runner) is amd64 natively so only affects local builds.
**How to diagnose in future**: `az containerapp logs show --name <app> --resource-group <rg> --type console` — will show `exec format error` if architecture is wrong.

### P7: Loki config env var substitution not working

**Symptom**: `illegal base64 data at input byte 0 / error creating object client` — Loki crashes on startup
**Cause**: Loki does NOT expand `${VAR}` in its config YAML by default. The literal string `${AZURE_STORAGE_ACCOUNT_KEY}` was passed to the Azure SDK as the storage key, which is not valid base64.
**Fix**: Added `-config.expand-env=true` startup flag in Dockerfile:
```dockerfile
# Before (env vars NOT expanded):
FROM --platform=linux/amd64 grafana/loki:3.4.2
COPY loki-config.yaml /etc/loki/local-config.yaml

# After (env vars expanded):
FROM --platform=linux/amd64 grafana/loki:3.4.2
COPY loki-config.yaml /etc/loki/local-config.yaml
CMD ["-config.file=/etc/loki/local-config.yaml", "-config.expand-env=true"]
```
**How to diagnose**: Check container logs — `illegal base64` or similar parse errors on config values that should be env vars.
**Note**: OTEL Collector supports `${env:VAR}` natively; Loki requires the explicit flag.

### P8: Loki official image cannot `apk add` (non-standard shell path)

**Symptom**: `RUN apk add --no-cache bash` fails with exit code 127 in `grafana/loki` Dockerfile
**Cause**: Loki's official image uses a busybox-based setup with shell at `/busybox/sh` instead of standard `/bin/sh`. The `apk` command cannot be found.
**Fix**: Switched to multi-stage build — extract `/usr/bin/loki` binary from official image, use `alpine:3.21` as final base. Same approach applied to OTEL Collector (which used scratch with no shell at all).

### P9: Azure Container Apps ignores image update with same tag

**Symptom**: `az containerapp update --image ...:nightly` completes successfully but no new revision is created — container still runs the old image.
**Cause**: Azure caches images by tag. If the tag (`:nightly`) hasn't changed, Azure skips pulling the new image even if the digest is different.
**Fix**: Use a different tag to force a new image pull:
```bash
# Push with new tag
docker tag trinity-otel:test deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly-v2
docker push deltasharedtestkrcacr.azurecr.io/trinity/otel:nightly-v2

# Update with new tag — forces new revision
az containerapp update --name <app> --resource-group <rg> --image ...:nightly-v2
```
**Prevention**: In CI/CD, always use unique tags (e.g., commit SHA: `:nightly-abc1234`) instead of overwriting a fixed tag. The existing `docker-publish.yml` already tags with SHA — this issue only affects manual pushes.

### P10: Internal ingress uses HTTPS, not HTTP

**Symptom**: OTEL Collector receives logs successfully (`partialSuccess:{}`), but Loki query returns empty results. Collector cannot reach Loki via `http://...internal...:3100`.
**Cause**: Azure Container Apps internal ingress uses **HTTPS on port 443** by default, not the container's target port. `http://...:3100` hangs because there's no listener on that address from outside the container.
**Fix**: Changed `LOKI_ENDPOINT` from `http://` to `https://` and removed the port:
```bash
# Before (broken):
LOKI_ENDPOINT=http://trinity-loki-test-krc-aca.internal.wittyriver-dea6278d.koreacentral.azurecontainerapps.io/otlp

# After (fixed):
LOKI_ENDPOINT=https://trinity-loki-test-krc-aca.internal.wittyriver-dea6278d.koreacentral.azurecontainerapps.io/otlp
```
**Rule**: Container Apps internal ingress always uses `https://<app>.internal.<cae-domain>` (port 443), even though the container listens on a different port (e.g., 3100). Azure's ingress proxy handles the TLS termination and port mapping.

---

## End-to-End Verification

### Step 1: Send test log to OTEL Collector

Exec into **OTEL Collector** container via Azure Portal console:

```bash
# Send a test log with current timestamp
wget -qO- --post-data='{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test-cloud"}}]},"scopeLogs":[{"logRecords":[{"timeUnixNano":"'$(date +%s)000000000'","body":{"stringValue":"Hello from cloud OTEL!"},"severityText":"INFO"}]}]}]}' --header='Content-Type: application/json' http://localhost:4318/v1/logs
```

Expected response: `{"partialSuccess":{}}` — means Collector accepted the log.

### Step 2: Query Loki to verify log arrived

Exec into **Loki** container via Azure Portal console:

```bash
# Query for the test log (URL-encoded LogQL query)
wget -qO- "http://localhost:3100/loki/api/v1/query_range?query=%7Bservice_name%3D%22test-cloud%22%7D&limit=5"
```

Expected: `"result"` array contains `"Hello from cloud OTEL!"` with `service_name: test-cloud`.

### Step 3: Verify internal network (from Collector to Loki)

Exec into **OTEL Collector** container:

```bash
# Check Loki is reachable via internal HTTPS
wget -qO- https://trinity-loki-test-krc-aca.internal.wittyriver-dea6278d.koreacentral.azurecontainerapps.io/ready
# Expected: "ready"
```

### Health Check Commands

```bash
# OTEL Collector health (exec into OTEL container)
wget -qO- http://localhost:13133/
# Expected: {"status":"Server available","upSince":"...","uptime":"..."}

# Loki health (exec into Loki container)
wget -S -qO- http://localhost:3100/ready 2>&1
# Expected: HTTP/1.1 200 OK, body: "ready"

# Loki module status
wget -qO- http://localhost:3100/services
# Expected: all modules show "=> Running"
```

### CLI-based checks (from local machine)

```bash
# Revision status
az containerapp revision list --name <app> --resource-group <rg> \
  --query '[?properties.active].{name:name, replicas:properties.replicas, state:properties.runningState, health:properties.healthState}' -o table

# Container logs
az containerapp logs show --name <app> --resource-group <rg> --type console --tail 20
```

---

## TODO — Remaining Steps

### Immediate (to complete this deployment)

- [ ] **Loki secret**: Confirm `az containerapp secret set` completed; if not, retry
- [ ] **Loki env vars**: Update Loki to use `secretRef:azure-storage-key` for `AZURE_STORAGE_ACCOUNT_KEY`:
  ```bash
  az containerapp update \
    --name trinity-loki-test-krc-aca \
    --resource-group trinity-loki-test-krc-rg \
    --set-env-vars \
      "AZURE_STORAGE_ACCOUNT_NAME=deltatestkrcstorage" \
      "AZURE_STORAGE_ACCOUNT_KEY=secretref:azure-storage-key" \
      "AZURE_STORAGE_CONTAINER_NAME=loki-chunks"
  ```
- [ ] **Loki health probe**: Verify Loki is healthy (`/ready` returns 200), then enable health probes via Merlin redeploy
- [ ] **ACR role assignment**: Get Owner to run `az role assignment create` for both OTEL Collector and Loki (see P5 above)
- [ ] **Get CAE default domain**:
  ```bash
  az containerapp env show \
    --name delta-shared-test-krc-cae \
    --resource-group delta-shared-test-krc-rg \
    --query 'properties.defaultDomain' -o tsv
  ```
- [ ] **OTEL → Loki**: Set `LOKI_ENDPOINT` on Collector pointing to Loki's internal FQDN:
  ```bash
  az containerapp update \
    --name trinity-otel-test-krc-aca \
    --resource-group trinity-otel-test-krc-rg \
    --set-env-vars "LOKI_ENDPOINT=http://trinity-loki-test-krc-aca.internal.<cae-domain>/otlp"
  ```
- [ ] **Apps → Collector**: Add `OTEL_EXPORTER_OTLP_ENDPOINT` to web, home, admin, worker pointing to Collector's internal FQDN
- [ ] **End-to-end test**: Send a test log from an app, verify it appears in Loki via query

### Merlin Improvements (future)

- [ ] **Initial deploy with secrets**: Add mechanism to pass secret values for first-time Container App creation (e.g., `--secret-values` flag or read from environment). Currently Merlin only reads secrets from existing apps — fails on initial deploy with `secretRef` env vars.
- [ ] **infra.yaml cleanup**: Once deployment is stable, restore `secretRef` and `enableHealthProbes` in Loki config:
  ```yaml
  loki:
    enableHealthProbes: true  # re-enable
    healthProbePath: /ready
    environmentVariables:
      - name: AZURE_STORAGE_ACCOUNT_KEY
        secretRef: "azure-storage-key"  # uncomment
  ```
- [ ] **LOKI_ENDPOINT in infra.yaml**: Replace `${CAE_DEFAULT_DOMAIN}` placeholder with actual domain or add Merlin support for resolving CAE domain at deploy time

### Grafana

- [x] Decide: Azure Managed Grafana (`trinity-grafana` in `DevOps-RG`)
- [x] Deploy Grafana and connect to Loki data source
- [ ] Create dashboards and alerting rules

---

## Resource Reference

| Resource | Azure Name | Resource Group | Status |
|----------|-----------|----------------|--------|
| Storage Account | `deltatestkrcstorage` | `delta-shared-test-krc-rg` | ✅ Active |
| Blob Container | `loki-chunks` | (in storage account) | ✅ Active |
| OTEL Collector | `trinity-otel-test-krc-aca` | `trinity-otel-test-krc-rg` | ✅ Running (revision --0000005) |
| Loki | `trinity-loki-test-krc-aca` | `trinity-loki-test-krc-rg` | ✅ Running (revision --0000002, external + IP whitelist) |
| CAE | `delta-shared-test-krc-cae` | `delta-shared-test-krc-rg` | ✅ Active (shared) |
| ACR | `deltasharedtestkrcacr` | `delta-shared-test-krc-rg` | ✅ Active (shared) |
| Grafana | `trinity-grafana` | `DevOps-RG` | ✅ Azure Managed Grafana, Loki data source connected |

### Key Values

| Key | Value |
|-----|-------|
| Grafana URL | `https://trinity-grafana-bpc6gfcehqgbc3eu.sel.grafana.azure.com` |
| Grafana Outbound IPs | `20.249.48.4`, `20.214.216.216` (whitelisted on Loki) |
| Loki External URL | `https://trinity-loki-test-krc-aca.wittyriver-dea6278d.koreacentral.azurecontainerapps.io` |
| Loki Internal URL | `https://trinity-loki-test-krc-aca.internal.wittyriver-dea6278d.koreacentral.azurecontainerapps.io` |
| OTEL Collector Internal URL | `https://trinity-otel-test-krc-aca.internal.wittyriver-dea6278d.koreacentral.azurecontainerapps.io` |
| CAE Default Domain | `wittyriver-dea6278d.koreacentral.azurecontainerapps.io` |
| Storage Account Key | `az storage account keys list --account-name deltatestkrcstorage --resource-group delta-shared-test-krc-rg --query '[0].value' -o tsv` |
| OTEL Collector Principal ID | `90ed13a7-c9ce-4fe3-979e-da5d2974d29b` |
| Loki Principal ID | `26c9bb29-02eb-4f1d-bb4f-f0ef7ea8aba9` |
