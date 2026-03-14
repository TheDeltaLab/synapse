# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with pnpm and build deps
# ============================================
FROM node:20-alpine AS base

# Install pnpm and build dependencies for native modules (bcrypt)
RUN apk add --no-cache libc6-compat python3 make g++ && \
    corepack enable && \
    corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# ============================================
# Stage 2: Install all dependencies
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
COPY --from=deps /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/dal/node_modules ./packages/dal/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/gateway/ ./apps/gateway/
COPY packages/shared/ ./packages/shared/
COPY packages/dal/ ./packages/dal/
COPY packages/config/ ./packages/config/

# Generate Prisma client
RUN pnpm --filter @synapse/dal db:generate

# Build gateway and all its workspace dependencies (... suffix includes deps automatically)
RUN pnpm --filter gateway... build

# ============================================
# Stage 4: Production dependencies only
# ============================================
FROM base AS prod-deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/
COPY packages/dal/package.json ./packages/dal/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ============================================
# Stage 5: Production runner
# ============================================
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 synapse && \
    adduser --system --uid 1001 --ingroup synapse synapse

# Copy production node_modules (external packages like bcrypt, ioredis, pg need to be available)
COPY --from=prod-deps --chown=synapse:synapse /app/node_modules ./node_modules
COPY --from=prod-deps --chown=synapse:synapse /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=prod-deps --chown=synapse:synapse /app/packages/dal/node_modules ./packages/dal/node_modules

# Copy built application (workspace packages are bundled by tsup)
COPY --from=builder --chown=synapse:synapse /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder --chown=synapse:synapse /app/apps/gateway/package.json ./apps/gateway/

# Copy Prisma schema and generated client (needed at runtime for Prisma)
COPY --from=builder --chown=synapse:synapse /app/packages/dal/prisma ./packages/dal/prisma
COPY --from=builder --chown=synapse:synapse /app/packages/dal/generated ./packages/dal/generated

# Copy root package.json and pnpm-workspace.yaml for workspace resolution
COPY --chown=synapse:synapse package.json pnpm-workspace.yaml ./

USER synapse

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/gateway/dist/index.js"]
