# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Synapse is a TypeScript monorepo containing an **AI Gateway** - a Hono-based HTTP server that provides OpenAI-compatible chat completion endpoints while routing to multiple LLM providers (OpenAI, Anthropic, Google) with fallback strategies, rate limiting, and PostgreSQL-backed usage tracking.

## Commands

### Development
```bash
pnpm dev                    # Run gateway with hot reload (tsx watch)
pnpm build                  # Build all packages then apps
pnpm lint                   # Run ESLint on all packages
pnpm type-check             # Run TypeScript compiler (no emit)
pnpm clean                  # Remove dist folders and node_modules
```

### Database (run from packages/dal or use filter)
```bash
pnpm --filter @synapse/dal db:generate   # Generate Prisma client
pnpm --filter @synapse/dal db:migrate    # Run migrations (dev)
pnpm --filter @synapse/dal db:push       # Push schema to database
pnpm --filter @synapse/dal db:studio     # Open Prisma Studio
pnpm --filter @synapse/dal db:seed       # Seed database
```

### Running a Single Package
```bash
pnpm --filter @synapse/gateway dev       # Run only gateway
pnpm --filter @synapse/dashboard dev     # Run only dashboard (port 3001)
pnpm --filter @synapse/shared lint       # Lint only shared package
```

## Architecture

```
synapse/
├── apps/
│   ├── gateway/              # Hono HTTP server (port 3000)
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── app.ts        # Route setup & middleware chain
│   │   │   ├── config/       # LLM provider configurations
│   │   │   ├── middleware/   # auth, logger, error handlers
│   │   │   ├── routes/v1/    # API endpoints (chat.ts)
│   │   │   ├── routes/admin.ts # Admin API (api-keys, logs, analytics)
│   │   │   └── services/     # Provider registry, auth service
│   │   └── Dockerfile        # Multi-stage Docker build
│   │
│   └── dashboard/            # Next.js admin dashboard (port 3001)
│       ├── src/
│       │   ├── app/(dashboard)/  # Dashboard pages
│       │   │   ├── playground/   # Interactive chat testing
│       │   │   ├── api-keys/     # API key management
│       │   │   ├── logs/         # Request logs table
│       │   │   └── logs/analytics/ # Analytics charts
│       │   ├── components/       # UI components
│       │   │   ├── layout/       # Sidebar, Header
│       │   │   ├── analytics/    # Chart components
│       │   │   └── logs/         # Log table, filters, detail dialog
│       │   └── lib/gateway.ts    # Gateway API client
│       └── Dockerfile        # Multi-stage Docker build (standalone)
│
├── packages/
│   ├── shared/               # Types, Zod schemas, utilities
│   │   └── src/schemas/      # Zod schemas (chat, admin, logs)
│   ├── dal/                  # Prisma ORM & encryption utilities
│   │   ├── prisma/schema.prisma
│   │   └── src/encryption.ts # AES-256-GCM content encryption
│   ├── config/               # Shared tsup build config
│   └── eslint-config/        # Shared ESLint rules
│
├── docs/                     # Documentation
│   └── AZURE_OIDC_SETUP.md   # Azure OIDC authentication setup
│
└── infrastructure/           # Azure deployment scripts
```

### Key Patterns

- **Singleton ProviderRegistry**: Centralizes LLM provider initialization and model retrieval
- **Middleware chain**: logger → cors → auth → routes → error handler
- **Path aliases**: Use `@synapse/shared`, `@synapse/dal` for imports
- **OpenAI-compatible API**: `POST /v1/chat/completions` accepts standard OpenAI request format
- **API key auth**: Bearer tokens validated against bcrypt hashes in PostgreSQL
- **Content encryption**: Optional AES-256-GCM encryption for prompt/response logging
- **Shared Header component**: Dashboard pages use `<Header>` component for consistent layout

### Database Models (Prisma)

- **ApiKey**: Stores hashed API keys with rate limits, expiry, multi-tenant userId
- **RequestLog**: Tracks every request with:
  - Provider, model, status code, latency
  - Token breakdown (inputTokens, outputTokens, totalTokens)
  - Encrypted content (promptContent, responseContent with IV and auth tag)
  - Cache tracking (cached, cacheType, cacheTtl, costSaving, latencySaving)

### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/api-keys` | GET/POST | List/create API keys |
| `/admin/api-keys/:id` | GET/PATCH/DELETE | Manage single API key |
| `/admin/providers` | GET | List available LLM providers |
| `/admin/logs` | GET | List request logs (paginated, filterable) |
| `/admin/logs/:id` | GET | Get single log with decrypted content |
| `/admin/logs/analytics` | GET | Aggregated stats for charts |

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.7, ESM modules
- **Framework**: Hono with @hono/node-server
- **Dashboard**: Next.js 14 with App Router
- **AI SDKs**: Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **ORM**: Prisma 7.4 with PostgreSQL
- **Caching**: ioredis
- **Charts**: Recharts (dashboard analytics)
- **Build**: tsup (esbuild-based), pnpm workspaces
- **Validation**: Zod schemas

## Environment Variables

Copy `.env.example` and configure:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` - LLM provider keys
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional)
- `PORT` - Gateway port (default 3000)
- `ENCRYPTION_KEY` - 32 bytes, base64 encoded for content encryption (optional)
  ```bash
  # Generate with:
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

## Important Notes

- **Package Manager**: This project uses pnpm exclusively. Always use `pnpm` or `pnpx` instead of `npm`/`npx`.
- **Use Latest Packages**: When installing new dependencies, always use `@latest` tag (e.g., `pnpm add package@latest`) unless there's a specific compatibility issue.
- **Dashboard Layout**: All dashboard pages should use the shared `<Header>` component and wrap content in `<div className="flex-1 p-6">` for consistent styling.
- **Prisma Changes**: After modifying `schema.prisma`, run `pnpm --filter @synapse/dal db:migrate` and `pnpm --filter @synapse/dal db:generate`.

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | PRs, pushes to main | Lint, type-check, build |
| `docker.yml` | Pushes to main, releases | Build & push images to GHCR |
| `release.yml` | Pushes to main | Release-please automation |
| `deploy-azure.yml` | After Docker, manual | Deploy to Azure Container Apps |

### Docker Images

Images are published to GitHub Container Registry:
- `ghcr.io/{owner}/synapse/gateway:nightly` - Latest main branch
- `ghcr.io/{owner}/synapse/gateway:latest` - Latest release
- `ghcr.io/{owner}/synapse/gateway:v1.2.3` - Specific version

```bash
# Build locally
docker build -f apps/gateway/Dockerfile -t synapse-gateway .
docker build -f apps/dashboard/Dockerfile -t synapse-dashboard .

# Run with Docker Compose
docker compose up
```

### Azure Deployment

Uses OIDC authentication (no stored secrets). Three environments: `test`, `staging`, `production`.

**Required GitHub Variables (repository level):**
- `AZURE_CLIENT_ID` - Azure AD Application ID
- `AZURE_TENANT_ID` - Azure AD Tenant ID

**Required GitHub Variables (per environment):**
- `AZURE_SUBSCRIPTION_ID` - Azure Subscription ID (can differ per environment)
- `GATEWAY_URL` - Gateway URL for health checks
- `DASHBOARD_URL` - Dashboard URL for health checks

See `docs/AZURE_OIDC_SETUP.md` for full setup instructions.

### Azure Doctor Script

Run the diagnostic script to check and fix Azure configuration:

```bash
./scripts/azure-doctor.sh
```

The script checks:
- Azure CLI login status
- Azure AD application and service principal
- Role assignments (Contributor on resource groups)
- Federated credentials for OIDC
- Container Apps access

It will prompt to auto-fix any issues found.

