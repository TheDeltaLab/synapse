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
pnpm --filter @synapse/shared lint       # Lint only shared package
```

## Architecture

```
synapse/
├── apps/
│   └── gateway/              # Hono HTTP server (port 3000)
│       ├── src/
│       │   ├── index.ts      # Entry point
│       │   ├── app.ts        # Route setup & middleware chain
│       │   ├── config/       # LLM provider configurations
│       │   ├── middleware/   # auth, logger, error handlers
│       │   ├── routes/v1/    # API endpoints (chat.ts)
│       │   └── services/     # Provider registry, auth service
│
├── packages/
│   ├── shared/               # Types, Zod schemas, utilities
│   ├── dal/                  # Prisma ORM (ApiKey, RequestLog models)
│   ├── config/               # Shared tsup build config
│   └── eslint-config/        # Shared ESLint rules
│
├── configs/                  # Portkey JSON gateway routing configs
└── infrastructure/           # Azure deployment scripts
```

### Key Patterns

- **Singleton ProviderRegistry**: Centralizes LLM provider initialization and model retrieval
- **Middleware chain**: logger → cors → auth → routes → error handler
- **Path aliases**: Use `@synapse/shared`, `@synapse/dal` for imports
- **OpenAI-compatible API**: `POST /v1/chat/completions` accepts standard OpenAI request format
- **API key auth**: Bearer tokens validated against bcrypt hashes in PostgreSQL

### Database Models (Prisma)

- **ApiKey**: Stores hashed API keys with rate limits, expiry, multi-tenant userId
- **RequestLog**: Tracks every request (provider, model, tokens, latency, cached status)

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.7, ESM modules
- **Framework**: Hono with @hono/node-server
- **AI SDKs**: Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`)
- **ORM**: Prisma 7.4 with PostgreSQL
- **Caching**: ioredis
- **Build**: tsup (esbuild-based), pnpm workspaces
- **Validation**: Zod schemas

## Environment Variables

Copy `.env.example` and configure:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` - LLM provider keys
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional)
- `PORT` - Gateway port (default 3000)

## Important Notes

- **Package Manager**: This project uses pnpm exclusively. Always use `pnpm` or `pnpx` instead of `npm`/`npx`.
