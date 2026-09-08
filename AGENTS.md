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
- `pnpm lint` — runs `pnpm -r lint`; only api actually lints (types `lint` is a stub that echo's a message)
- Focused checks:
  - `pnpm --filter @alfahd/api typecheck` — type-check only the api package
  - `pnpm --filter @alfahd/api test` — unit tests (`**/*.spec.ts` via `vitest.config.ts`)
  - `pnpm --filter @alfahd/api test:e2e` — e2e (`**/*.e2e-spec.ts` via `vitest.config.e2e.ts`)
  - `pnpm --filter @alfahd/api lint`
- Local services: `docker compose up -d` starts postgres:16 (user `alfahd`, db `alfahd_ems`, port 5432) and redis:7.

## Env & data layer

- Template is `apps/api/.env.example` (copy to `apps/api/.env`; both exist, `.env` is gitignored).
- Nothing loads `.env` yet — no ConfigModule dependency and no Prisma/ORM code exists (planned in `FUTURE.md`). `src/main.ts` reads `process.env.PORT` directly. Unit/e2e tests do NOT need docker services running.

## Style

- ESLint flat config `apps/api/eslint.config.mjs`: Prettier recommended; `@typescript-eslint/no-explicit-any` is off; unused vars warn, ignore args prefixed `_`.
- Prettier/`.editorconfig`: single quotes, trailing commas, printWidth 100, 2-space indent, LF.
- Repo has no commits yet (fresh, `master`); CI runs on PRs to `main`, deploy-api on push to `main` (Railway deploy step is a TODO).
