# Future Work — Deferred Items

> **Status**: Not started
> **Created**: 2026-09-08
> **Note**: These items are planned but deferred. Implement after initial scaffold is confirmed working.

---

## 1. Dockerfile for API

**Priority**: Medium
**When**: Before first deployment

Create a multi-stage Dockerfile for the API service.

### Requirements

- Multi-stage build (builder → runner)
- Install pnpm, build types, build API, prune dev dependencies
- Non-root user for security
- Health check endpoint
- Expose port from `.env` (default 3000)

### File: `apps/api/Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.26.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @alfahd/types build
RUN pnpm --filter @alfahd/api build

# Stage 2: Production
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.26.0 --activate
WORKDIR /app
RUN addgroup -g 1001 -S alfahd && adduser -S alfahd -u 1001
COPY --from=builder --chown=alfahd:alfahd /app/packages/types/dist ./packages/types/dist
COPY --from=builder --chown=alfahd:alfahd /app/packages/types/package.json ./packages/types/
COPY --from=builder --chown=alfahd:alfahd /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=alfahd:alfahd /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=alfahd:alfahd /app/node_modules ./node_modules
USER alfahd
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

### Verification

- Build image: `docker build -f apps/api/Dockerfile .`
- Run container: `docker run -p 3000:3000 --env-file apps/api/.env alfahd-api`
- Verify API responds on `http://localhost:3000`

---

## 2. CI Caching

**Priority**: Medium
**When**: After CI workflow is confirmed working

Add pnpm store caching to GitHub Actions workflows to speed up CI by 2-3x.

### Changes to `.github/workflows/ci.yml` and `deploy-api.yml`

Add after `Setup pnpm` step:

```yaml
- name: Get pnpm store directory
  shell: bash
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT
  id: pnpm-cache

- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

### Verification

- Run CI workflow
- Check that subsequent runs are faster (cache hit)
- Verify `pnpm install --frozen-lockfile` still works with cached store

---

## 3. Dependabot Configuration

**Priority**: Low
**When**: After repo is pushed to GitHub

Automated dependency updates via GitHub Dependabot.

### File: `.github/dependabot.yml`

```yaml
version: 2
updates:
  # Root dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    groups:
      nestjs:
        patterns:
          - "@nestjs/*"
      typescript:
        patterns:
          - "typescript"
      eslint:
        patterns:
          - "eslint*"
          - "@eslint/*"

  # API dependencies
  - package-ecosystem: "npm"
    directory: "/apps/api"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"

  # Types package dependencies
  - package-ecosystem: "npm"
    directory: "/packages/types"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci"
```

### Verification

- Push repo to GitHub
- Wait for first Dependabot run (usually within 24 hours)
- Verify PRs are created for outdated dependencies
- Check that grouping works (multiple NestJS updates in one PR)

---

## 4. Additional Future Items (Not Yet Scoped)

These are known needs but not yet detailed:

- [ ] Prisma setup (after scaffold confirmed working)
- [ ] Authentication module (JWT + refresh tokens)
- [ ] Logging setup (pino/nestjs-pino)
- [ ] Swagger/OpenAPI documentation
- [ ] Health check endpoint (`/health`)
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] Request validation with class-validator or zod
- [ ] Error handling middleware
- [ ] Database migrations strategy
- [ ] Environment variable validation (envalid)
