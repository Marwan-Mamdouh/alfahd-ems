# =============================================================
# Stage 1: Base runtime with pnpm enabled
# =============================================================
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# =============================================================
# Stage 2: Dependencies and Build
# =============================================================
FROM base AS builder
WORKDIR /app

# Build tools for compiling native addons (such as argon2) on Linux alpine
RUN apk add --no-cache libc6-compat python3 make g++

# Copy root workspace manifests and configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install full dependencies across the workspace
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build shared types first (mandatory before API compilation per AGENTS.md)
RUN pnpm --filter @alfahd/types build

# Build API with SWC compiler
RUN pnpm --filter @alfahd/api build

# Deploy isolated production bundle with only production dependencies
RUN pnpm --filter @alfahd/api deploy --prod /app/pruned

# =============================================================
# Stage 3: Lean Production Runner Image
# =============================================================
FROM node:22-alpine AS runner
WORKDIR /app

# Install dumb-init for proper PID 1 signal forwarding and libc6-compat for native addons
RUN apk add --no-cache dumb-init libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Copy pruned production deployment from builder
COPY --from=builder --chown=node:node /app/pruned /app

# Ensure compiled API dist and Drizzle migrations are present
COPY --from=builder --chown=node:node /app/apps/api/dist /app/dist
COPY --from=builder --chown=node:node /app/apps/api/drizzle /app/drizzle

# Verify argon2 native module compiles and loads successfully in Linux
RUN node -e "import('argon2').then(() => console.log('argon2 native binding verified'))"

# Run as unprivileged non-root user
USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
