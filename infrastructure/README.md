## Azure Setup Checklist (Secrets)
To make the above work, you need to add these GitHub Secrets (`Settings > Secrets and variables > Actions`):

1. `PORTKEY_ORG_KEY`: Found in your Portkey Dashboard.

2. `REDIS_URL`: (Optional but Recommended) The connection string for Azure Cache for Redis.

    * Format: `rediss://:password@your-redis-name.redis.cache.windows.net:6380`

3. `AZURE_CREDENTIALS`: Generate this using the Azure CLI so GitHub can talk to your Azure account:
```Bash
az ad sp create-for-rbac --name "synapse-github-actions" --role contributor \
  --scopes /subscriptions/11fc5efa-7f79-4c83-b6d9-dbe109e00987/resourceGroups/rg-synapse \
  --sdk-auth
```
Copy the resulting JSON block entirely into the secret.