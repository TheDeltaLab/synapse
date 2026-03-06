# Synapse AI Gateway

A TypeScript monorepo containing an **AI Gateway** - a Hono-based HTTP server that provides OpenAI-compatible chat completion endpoints while routing to multiple LLM providers (OpenAI, Anthropic, Google, DeepSeek, OpenRouter) with fallback strategies, rate limiting, and PostgreSQL-backed usage tracking.

## Repository Structure

```
synapse/
├── apps/
│   ├── gateway/              # Hono HTTP server (port 3000)
│   └── dashboard/            # Next.js admin dashboard (port 3001)
├── packages/
│   ├── shared/               # Types, Zod schemas, utilities
│   ├── dal/                  # Prisma ORM & encryption utilities
│   ├── config/               # Shared tsup build config
│   └── eslint-config/        # Shared ESLint rules
├── infrastructure/           # Azure deployment scripts
├── .github/workflows/        # CI/CD pipelines
├── docker-compose.yml        # Local development with Docker
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10.28+
- PostgreSQL (or use Docker Compose)
- Redis (optional, for caching)

### Local Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @synapse/dal db:generate

# Run migrations
pnpm --filter @synapse/dal db:migrate

# Start development servers (gateway + dashboard)
pnpm dev
```

### Docker Compose

```bash
# Start full stack (postgres, redis, gateway, dashboard)
docker compose up --build

# Production mode only (no hot reload)
docker compose -f docker-compose.yml up
```

## API Usage

### Chat Completions (OpenAI-compatible)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-synapse-provider: openai" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Environment Variables

Copy `.env.example` and configure:

```bash
# LLM Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/synapse

# Optional
REDIS_URL=redis://localhost:6379
PORT=3000
ENCRYPTION_KEY=<base64-encoded-32-bytes>
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation, commands, and development guidelines.

## License

MIT
