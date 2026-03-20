# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with pnpm
# ============================================
FROM node:20-alpine AS base

# Install pnpm
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
COPY packages/shared/package.json ./packages/shared/
COPY packages/dal/package.json ./packages/dal/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install all dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/dal/node_modules ./packages/dal/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/dashboard/ ./apps/dashboard/
COPY packages/shared/ ./packages/shared/
COPY packages/dal/ ./packages/dal/
COPY packages/config/ ./packages/config/

# Generate Prisma client (required by @synapse/dal)
RUN pnpm --filter @synapse/dal db:generate

# Build dashboard and all its workspace dependencies (... suffix includes deps automatically)
RUN pnpm --filter @synapse/dashboard... build

# ============================================
# Stage 4: Production runner
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nextjs && \
    adduser --system --uid 1001 --ingroup nextjs nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nextjs /app/apps/dashboard/.next/standalone ./
# Static files must be at apps/dashboard/.next/static because server.js runs from apps/dashboard/
COPY --from=builder --chown=nextjs:nextjs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

USER nextjs

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
# GATEWAY_URL is set at runtime via Azure Container Apps environment variables
# Example: GATEWAY_URL=https://synapse-gateway-test.azurecontainerapps.io

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["node", "apps/dashboard/server.js"]
