# Alfahd-EMS Monorepo Setup Plan

> **Status**: Ready to execute
> **Date**: 2026-09-08
> **Module system**: ESM (not CommonJS)
> **Package manager**: pnpm (workspaces)
> **Test runner**: Vitest (NestJS CLI v12 default for ESM)

---

## Environment Requirements

- Node >= 22.12 (v24.19.0 confirmed)
- pnpm >= 9 (v11.26.0 confirmed)
- NestJS CLI v12.0.0 (latest)

---

## Implementation Steps

### Step 1 — Create `.gitignore`

Must be created first to prevent accidental commits of `node_modules/`, `dist/`, `.env` files.

```
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/

# Environment files
.env
.env.local
.env.*.local

# Drizzle (migrations in apps/api/drizzle/ are committed intentionally)

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test coverage
coverage/
```

### Step 2 — Create `.editorconfig`

Ensures consistent formatting across editors.

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

### Step 3 — Update root `package.json`

Replace current file. Remove `"type": "module"` — pnpm workspaces handle ESM detection per-package. Remove unnecessary fields. Add `packageManager` field for Corepack.

```json
{
  "name": "alfahd-ems",
  "private": true,
  "packageManager": "pnpm@11.26.0",
  "scripts": {
    "api:dev": "pnpm --filter @alfahd/api start:dev",
    "api:build": "pnpm --filter @alfahd/api build",
    "types:build": "pnpm --filter @alfahd/types build",
    "types:dev": "pnpm --filter @alfahd/types dev",
    "lint": "pnpm -r lint",
    "lint:fix": "pnpm -r lint:fix",
    "test": "pnpm -r test"
  },
  "engines": {
    "node": ">=22.12.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Note**: No `"type": "module"` at root level. Each package declares its own module type.

### Step 4 — Update `pnpm-workspace.yaml`

Clean up the `allowBuilds` section.

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Step 5 — Create `tsconfig.base.json`

Use `ES2022` target (Node 22 supports it natively, gives `Array.at()`, `Object.hasOwn()`, top-level await).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Why `Node16` module/resolution**: This is the recommended setting for Node.js ESM projects. It supports both ESM and CJS interop correctly.

### Step 6 — Update `packages/types/`

#### `packages/types/package.json`

```json
{
  "name": "@alfahd/types",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "dev": "tsc --project tsconfig.json --watch",
    "lint": "echo 'no linter configured for types yet'"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Key**: `"type": "module"` makes this an ESM package. Added `exports` field for proper ESM resolution.

#### `packages/types/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

#### `packages/types/src/index.ts`

Create with the enum content as specified.

### Step 7 — Scaffold NestJS in `apps/api`

Run from repo root:

```bash
pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git --strict
```

When prompted: Select **CommonJS** — wait, no. The user wants ESM.

**CORRECTION**: Select **ESM** when prompted. This gives:

- Vitest for testing
- oxlint for linting (we'll replace with ESLint)
- ESM module system

After scaffolding:

1. Verify `apps/api/package.json` has `"type": "module"`
2. Verify `vitest.config.ts` exists (not jest.config.js)
3. Change `name` to `"@alfahd/api"`
4. Remove oxlint config (we'll use ESLint instead)

### Step 8 — Enable SWC in `apps/api`

Update `apps/api/package.json` scripts:

- `"start:dev"` → `"nest start --watch -b swc"`
- `"build"` → `"nest build -b swc"`

SWC is still useful with ESM because:

- `nest build` uses tsc by default — SWC makes it ~20x faster
- `nest start --watch` benefits from faster compilation
- Vitest already uses esbuild for test transforms, so SWC isn't needed there

### Step 9 — Add `@alfahd/types` dependency

In `apps/api/package.json`, add to dependencies:

```json
"@alfahd/types": "workspace:*"
```

### Step 10 — Update `apps/api/tsconfig.json`

Add `"extends": "../../tsconfig.base.json"` while keeping NestJS-specific options.

### Step 11 — Set up ESLint for ESM

Replace oxlint (generated by NestJS CLI) with ESLint.

#### Install dependencies (from root)

```bash
pnpm --filter @alfahd/api add -D eslint @eslint/js typescript-eslint eslint-plugin-prettier eslint-config-prettier prettier
```

#### Create `apps/api/eslint.config.mjs`

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.*"],
  },
);
```

#### Create `apps/api/.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

#### Update `apps/api/package.json` scripts

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix"
```

#### Remove oxlint config

Delete `apps/api/oxlint.json` if it exists.

### Step 12 — Docker Compose

Create `docker-compose.yml` with health checks:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    container_name: alfahd_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: alfahd
      POSTGRES_PASSWORD: alfahd_dev_password
      POSTGRES_DB: alfahd_ems
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alfahd"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: alfahd_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Step 13 — `.env.example` and `.env`

Create `apps/api/.env.example` and copy to `apps/api/.env`.

### Step 14 — GitHub Actions

Create `.github/workflows/ci.yml` and `.github/workflows/deploy-api.yml` as specified, with additions:

- pnpm store caching
- `pnpm audit` step
- Lint step

### Step 15 — CODEOWNERS

Create `.github/CODEOWNERS` with placeholder username.

### Step 16 — Install dependencies

Run `pnpm install` from root.

### Step 17 — Verify

1. `pnpm --filter @alfahd/types build`
2. `pnpm --filter @alfahd/api build`
3. `pnpm --filter @alfahd/api test`
4. Directory tree listing

---

## Key Decisions

| Decision          | Choice               | Reason                                               |
| ----------------- | -------------------- | ---------------------------------------------------- |
| Module system     | ESM                  | Future-proof, Node ecosystem moving to ESM           |
| Test runner       | Vitest               | NestJS CLI v12 default for ESM, faster than Jest     |
| Linter            | ESLint + Prettier    | Industry standard, better NestJS support than oxlint |
| Build tool        | SWC                  | Faster tsc for production builds                     |
| TypeScript target | ES2022               | Node 22 native support, useful APIs                  |
| Module resolution | Node16               | Correct ESM/CJS interop for Node.js                  |
| Shared code       | `@alfahd/types` only | Sufficient for current needs, avoid over-engineering |
