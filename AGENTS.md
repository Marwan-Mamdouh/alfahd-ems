# AGENTS.md

pnpm monorepo (ESM, Node >=22.12). Two active packages; `apps/web` and `apps/mobile` are empty placeholders with no scripts.

- `apps/api` — NestJS 12 REST API (`@alfahd/api`), SWC build, Vitest tests.
- `packages/types` — `@alfahd/types`, shared TS enums (`Role`, `TicketStatus`, `RouterStatus`, etc.), tsc build.

## Critical gotchas

- `apps/api` depends on `@alfahd/types` via `workspace:*`, resolved from its **built** `dist/` (not `src/`). Always build types _before_ anything that compiles/imports them: `pnpm --filter @alfahd/types build` (or `types:dev` watch). CI runs this exact order: types build -> api lint -> api build -> api test. A fresh `pnpm install` alone is NOT enough.
- ESM: relative imports in API source require the explicit `.js` extension (`./app.module.js`, not `./app.module`). Omit it and it breaks at runtime.
- `nest build -b swc` and `nest start --watch -b swc` skip type checking. Run `pnpm typecheck` yourself after edits.

## Commands (from repo root)

- `pnpm api:dev` — watch server (reads `PORT`, default 3000)
- `pnpm api:build` — SWC build; `pnpm types:build` — build shared types
- `pnpm typecheck` — runs `tsc --noEmit` via `pnpm -r typecheck` (only api defines it)
- `pnpm lint` / `pnpm test` — must stay as `pnpm -r` delegation. Do NOT replace with direct `eslint`/`vitest` calls: no ESLint config or vitest binary exists at root (both live in `apps/api` only). This broke PR #18.
- Focused checks:
  - `pnpm --filter @alfahd/api typecheck` — type-check only the api package
  - `pnpm --filter @alfahd/api test` — unit tests (`**/*.spec.ts` via `vitest.config.ts`)
  - `pnpm --filter @alfahd/api test:e2e` — e2e (`**/*.e2e-spec.ts` via `vitest.config.e2e.ts`)
  - `pnpm --filter @alfahd/api lint`
- Local services: `docker compose up -d` starts postgres:16 (user `alfahd`, db `alfahd_ems`, port 5432) and redis:7.

- Pre-commit (`.husky/pre-commit`, installed via root `prepare: husky` on `pnpm install`): types build -> api typecheck -> api format -> api lint -> api test. Do not bypass it; keep it green before pushing.

## Env & data layer

- Template is `apps/api/.env.example` (copy to `apps/api/.env`; both exist, `.env` is gitignored).
- Nothing loads `.env` yet — no ConfigModule dependency and no Prisma/ORM code exists (planned in `FUTURE.md`). `src/main.ts` reads `process.env.PORT` directly. Unit/e2e tests do NOT need docker services running.

## Style

- ESLint flat config `apps/api/eslint.config.mjs`: Prettier recommended; `@typescript-eslint/no-explicit-any` is off; unused vars warn, ignore args prefixed `_`.
- Prettier/`.editorconfig`: single quotes, trailing commas, printWidth 100, 2-space indent, LF.
- Default branch is `master`. CI runs on PRs to `master`; deploy-api runs on push to `master` (Railway deploy step is a TODO).
- CI uses `packageManager` from `package.json` (pnpm 11.26, Node 22) with `--frozen-lockfile`; `pnpm audit --audit-level=high` runs but does not fail the build.
- Use `git switch <branch>` instead of `git checkout` for branch switching (safer, explicit intent).
- Commit messages must use conventional prefix + useful what/why, e.g. `feat: introduce JWT guard to help protect routes`, `fix: restore root lint delegation to help unbreak CI`. Never vague (`fix stuff`, `update`). Only commit, amend, push, or open PRs when explicitly asked.
