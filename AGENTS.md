# AGENTS.md

pnpm monorepo (ESM, Node >=22.12). Active packages: `apps/api`, `apps/web` (`fahd-dashboard`, Next.js), `packages/types`; `apps/mobile` is an empty placeholder with no scripts.

- `apps/api` — NestJS 12 REST API (`@alfahd/api`), SWC build, Vitest tests.
- `packages/types` — `@alfahd/types`, shared TS enums (`Role`, `TicketStatus`, `RouterStatus`, etc.), tsc build.

## Critical gotchas

- `apps/api` depends on `@alfahd/types` via `workspace:*`, resolved from its **built** `dist/` (not `src/`). Always build types _before_ anything that compiles/imports them: `pnpm --filter @alfahd/types build` (or `types:dev` watch). CI runs this exact order: types build -> api lint -> api build -> api test. A fresh `pnpm install` alone is NOT enough.
- ESM: relative imports in API source require the explicit `.js` extension (`./app.module.js`, not `./app.module`). Omit it and it breaks at runtime.
- `nest build -b swc` and `nest start --watch -b swc` skip type checking. Run `pnpm typecheck` yourself after edits.

## Commands (from repo root)

- `pnpm dev` — builds types, then runs all `dev` scripts in parallel (types watch + api + web)
- `pnpm api:dev` — canonical api watch server (builds types first, then `start:dev`; reads `PORT`, default 3000)
- `pnpm dev:web` — Next.js dev server (`fahd-dashboard`)
- `pnpm infra:up` / `pnpm infra:down` — start/stop local services (`docker compose up -d` / `down`)
- `pnpm api:build` — SWC build; `pnpm types:build` — build shared types
- `pnpm typecheck` — runs `tsc --noEmit` via `pnpm -r typecheck` (only api defines it)
- `pnpm lint` / `pnpm test` — must stay as `pnpm -r` delegation. Do NOT replace with direct `eslint`/`vitest` calls: no ESLint config or vitest binary exists at root (both live in `apps/api` only). This broke PR #18.
- Focused checks:
  - `pnpm --filter @alfahd/api typecheck` — type-check only the api package
  - `pnpm --filter @alfahd/api test` — unit tests (`**/*.spec.ts` via `vitest.config.ts`)
  - `pnpm --filter @alfahd/api test:e2e` — e2e (`**/*.e2e-spec.ts` via `vitest.config.e2e.ts`)
  - `pnpm --filter @alfahd/api lint`
- Local services: `docker compose up -d` starts postgres:16 (user `alfahd`, db `alfahd_ems`, port 5432) and redis:7.

- Pre-commit (`.husky/pre-commit`, installed via root `prepare: husky` on `pnpm install`): types build -> api typecheck -> api format -> api lint -> api test. Full-project gates (`pnpm typecheck`/`lint`/`build`/`test`) run in CI. Do not bypass it; keep it green before pushing.

## Env & data layer

- Template is `apps/api/.env.example` (copy to `apps/api/.env`; both exist, `.env` is gitignored).
- `ConfigModule` (global, Zod-validated) loads `.env`; `src/main.ts` reads `PORT` via `ConfigService`. Drizzle (`drizzle-orm` + `pg`, config `apps/api/drizzle.config.ts`, migrations in `apps/api/drizzle/`, `DatabaseModule` in `src/database/`) targets local Docker PostgreSQL. Unit/e2e tests do NOT need docker services running (the `pg` pool connects lazily).

## Style

- ESLint flat config `apps/api/eslint.config.mjs`: Prettier recommended; `@typescript-eslint/no-explicit-any` is off; unused vars warn, ignore args prefixed `_`.
- Prettier/`.editorconfig`: single quotes, trailing commas, printWidth 100, 2-space indent, LF.
- Default branch is `master`. CI runs on PRs to `master`; deploy-api runs on push to `master` (deployment step explicitly deferred, no Railway yet).
- CI uses `packageManager` from `package.json` (pnpm 11.26, Node 22) with `--frozen-lockfile`; `pnpm audit --audit-level=high` runs but does not fail the build.
- Use `git switch <branch>` instead of `git checkout` for branch switching (safer, explicit intent).
- Update feature branches with `git rebase origin/master`, never `git merge origin/master`: merge commits break GitHub's rebase button (`This branch can't be rebased`). On pnpm conflicts, union both sides' `allowBuilds` in `pnpm-workspace.yaml`, then regenerate (never hand-edit markers): `pnpm install --no-frozen-lockfile && git add pnpm-workspace.yaml pnpm-lock.yaml && git rebase --continue`.
- Commit messages must use conventional prefix + useful what/why, e.g. `feat: introduce JWT guard to help protect routes`, `fix: restore root lint delegation to help unbreak CI`. Never vague (`fix stuff`, `update`). Only commit, amend, push, or open PRs when explicitly asked.
