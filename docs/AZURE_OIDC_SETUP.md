# Azure OIDC Setup for GitHub Actions

This guide explains how to set up Azure authentication for GitHub Actions using OpenID Connect (OIDC), which is more secure than using stored credentials.

## Why OIDC?

- **No secrets to rotate**: OIDC uses short-lived tokens instead of long-lived credentials
- **No secret sprawl**: Credentials aren't stored in GitHub Secrets
- **Audit trail**: Azure AD logs all authentication events
- **Least privilege**: Can scope permissions per environment

## Prerequisites

- Azure CLI installed (`az`)
- Owner or Contributor access to your Azure subscription
- Admin access to your GitHub repository

## Step 1: Create Azure AD Application

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "<SUBSCRIPTION_NAME_OR_ID>"

# Create the application
az ad app create --display-name "synapse-github-actions"

# Note the appId (client ID) from the output
```

## Step 2: Create Service Principal

```bash
# Get the app ID from Step 1
APP_ID="<APP_ID_FROM_STEP_1>"

# Create service principal
az ad sp create --id $APP_ID

# Note the service principal object ID from the output
```

## Step 3: Assign Azure Roles

Grant the service principal access to deploy to Azure Container Apps:

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_OBJECT_ID="<SERVICE_PRINCIPAL_OBJECT_ID>"

# Contributor role on the subscription (or scope to specific resource groups)
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

For more restrictive access, scope to specific resource groups:

```bash
# Test environment
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/synapse-test-rg"

# Staging environment
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/synapse-staging-rg"

# Production environment
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/synapse-rg"
```

## Step 4: Configure Federated Credentials

Create federated credentials for each GitHub environment:

```bash
APP_ID="<APP_ID_FROM_STEP_1>"
GITHUB_ORG="<YOUR_GITHUB_ORG>"
GITHUB_REPO="synapse"

# For 'test' environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-test",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$GITHUB_ORG"'/'"$GITHUB_REPO"':environment:test",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# For 'staging' environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-staging",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$GITHUB_ORG"'/'"$GITHUB_REPO"':environment:staging",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# For 'production' environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-actions-production",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$GITHUB_ORG"'/'"$GITHUB_REPO"':environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

## Step 5: Configure GitHub Repository

### 5.1 Create GitHub Environments

1. Go to your repository → Settings → Environments
2. Create three environments: `test`, `staging`, `production`
3. For `staging` and `production`, consider adding:
   - **Required reviewers**: People who must approve deployments
   - **Wait timer**: Delay before deployment starts
   - **Deployment branches**: Restrict to `main` branch only

### 5.2 Add Repository Variables

Go to Settings → Secrets and variables → Actions → Variables tab:

| Variable | Value | Description |
|----------|-------|-------------|
| `AZURE_CLIENT_ID` | `<APP_ID>` | Azure AD Application (client) ID |
| `AZURE_TENANT_ID` | `<TENANT_ID>` | Azure AD Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `<SUBSCRIPTION_ID>` | Azure Subscription ID |

Get these values:
```bash
# Client ID (App ID)
az ad app list --display-name "synapse-github-actions" --query "[0].appId" -o tsv

# Tenant ID
az account show --query tenantId -o tsv

# Subscription ID
az account show --query id -o tsv
```

### 5.3 Add Environment Variables (per environment)

For each environment (test, staging, production), add these variables:

| Variable | Example Value |
|----------|---------------|
| `GATEWAY_URL` | `https://synapse-gateway-test.azurecontainerapps.io` |
| `DASHBOARD_URL` | `https://synapse-dashboard-test.azurecontainerapps.io` |

### 5.4 Add Environment Secrets (per environment)

For each environment, add these secrets:

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

## Step 6: Verify Setup

1. Trigger a manual deployment:
   ```bash
   gh workflow run deploy-azure.yml -f environment=test -f image_tag=nightly
   ```

2. Check the workflow run in GitHub Actions

3. Verify the Azure login step shows:
   ```
   Login successful.
   ```

## Troubleshooting

### Error: "AADSTS70021: No matching federated identity record found"

The federated credential subject doesn't match. Check:
- Environment name in workflow matches the federated credential
- Repository name is correct (case-sensitive)
- Organization name is correct

### Error: "AADSTS700024: Client assertion is not within its valid time range"

GitHub Actions runner clock is out of sync. This usually resolves on retry.

### Error: "Authorization failed"

The service principal doesn't have the required role. Check:
```bash
az role assignment list --assignee $SP_OBJECT_ID --output table
```

## Resource Naming Convention

| Environment | Resource Group | Gateway App | Dashboard App |
|-------------|---------------|-------------|---------------|
| test | `synapse-test-rg` | `synapse-gateway-test` | `synapse-dashboard-test` |
| staging | `synapse-staging-rg` | `synapse-gateway-staging` | `synapse-dashboard-staging` |
| production | `synapse-rg` | `synapse-gateway` | `synapse-dashboard` |

## Security Best Practices

1. **Use environment protection rules** for staging and production
2. **Scope role assignments** to specific resource groups, not the entire subscription
3. **Regularly audit** federated credentials and role assignments
4. **Use separate service principals** for different projects
