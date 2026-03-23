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
# Stage 2: Install all dependencies
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

# Install all dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/mock/node_modules ./apps/mock/node_modules

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/mock/ ./apps/mock/

# Build mock server (no workspace deps needed — standalone app)
RUN pnpm --filter @synapse/mock build

# ============================================
# Stage 4: Production dependencies only
# ============================================
FROM base AS prod-deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/mock/package.json ./apps/mock/
COPY packages/shared/package.json ./packages/shared/
COPY packages/dal/package.json ./packages/dal/
COPY packages/config/package.json ./packages/config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install production dependencies only for mock
RUN pnpm install --frozen-lockfile --prod --filter @synapse/mock

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

# Copy production node_modules
COPY --from=prod-deps --chown=synapse:synapse /app/node_modules ./node_modules
COPY --from=prod-deps --chown=synapse:synapse /app/apps/mock/node_modules ./apps/mock/node_modules

# Copy built application
COPY --from=builder --chown=synapse:synapse /app/apps/mock/dist ./apps/mock/dist
COPY --from=builder --chown=synapse:synapse /app/apps/mock/package.json ./apps/mock/

# Copy root package.json and pnpm-workspace.yaml for workspace resolution
COPY --chown=synapse:synapse package.json pnpm-workspace.yaml ./

USER synapse

# Environment
ENV NODE_ENV=production
ENV MOCK_OPENAI_PORT=9001
ENV MOCK_ANTHROPIC_PORT=9002
ENV MOCK_GOOGLE_PORT=9003
ENV MOCK_OPENROUTER_PORT=9004

EXPOSE 9001 9002 9003 9004

# Health check against the OpenAI mock server
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/mock/dist/index.js"]
