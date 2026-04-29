# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with pnpm
# ============================================
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy workspace configuration files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy all package.json files to ensure proper workspace resolution
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/mock/package.json ./apps/mock/
COPY packages/shared/package.json ./packages/shared/
COPY packages/dal/package.json ./packages/dal/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/observability/package.json ./packages/observability/

# Install all dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 synapse && \
    adduser --system --uid 1001 --ingroup synapse synapse

# Copy dal node_modules (contains prisma CLI and dependencies)
COPY --from=deps --chown=synapse:synapse /app/node_modules ./node_modules
COPY --from=deps --chown=synapse:synapse /app/packages/dal/node_modules ./packages/dal/node_modules

# Copy Prisma schema and migration files
COPY --chown=synapse:synapse packages/dal/prisma ./packages/dal/prisma
COPY --chown=synapse:synapse packages/dal/package.json ./packages/dal/

# Copy root package.json and pnpm-workspace.yaml for workspace resolution
COPY --chown=synapse:synapse package.json pnpm-workspace.yaml ./

USER synapse

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/dal/prisma/schema.prisma --url \"$DATABASE_URL\""]
