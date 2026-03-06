## Azure Setup Checklist (Secrets)

To make CI/CD work, add these GitHub Secrets (`Settings > Secrets and variables > Actions`):

### Required Secrets

1. **`AZURE_CREDENTIALS`**: Azure service principal JSON for deployment.
   ```bash
   az ad sp create-for-rbac --name "synapse-github-actions" --role contributor \
     --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/synapse-rg \
     --sdk-auth
   ```
   Copy the resulting JSON block entirely into the secret.

2. **`DATABASE_URL`**: PostgreSQL connection string for the gateway.
   ```
   postgresql://user:password@host:5432/synapse
   ```

### Optional Secrets

3. **`REDIS_URL`**: Connection string for Azure Cache for Redis.
   ```
   rediss://:password@your-redis-name.redis.cache.windows.net:6380
   ```

### Repository Variables

Add these as repository variables (`Settings > Secrets and variables > Actions > Variables`):

1. **`GATEWAY_URL`**: Production gateway URL (used for health checks and dashboard builds).
   ```
   https://synapse-gateway.<region>.azurecontainerapps.io
   ```

2. **`DASHBOARD_URL`**: Production dashboard URL (used for health checks).
   ```
   https://synapse-dashboard.<region>.azurecontainerapps.io
   ```

## Deployment

The deployment is automated via GitHub Actions:

1. **CI Workflow** (`ci.yml`): Runs lint, type-check, and build on every PR and push to main.

2. **Docker Workflow** (`docker.yml`): Builds and pushes Docker images to GitHub Container Registry (GHCR).
   - `nightly` tag for main branch pushes
   - `stable` + semver tags for releases

3. **Deploy Azure Workflow** (`deploy-azure.yml`): Deploys to Azure Container Apps after Docker images are built.

## Manual Deployment

```bash
# Deploy with default settings (dry-run mode)
./infrastructure/deploy.sh

# Execute deployment
./infrastructure/deploy.sh --execute

# Custom resource group and location
./infrastructure/deploy.sh --execute \
  --resource-group my-rg \
  --location eastus \
  --app-name my-gateway
```
