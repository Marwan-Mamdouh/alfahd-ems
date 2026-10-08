# Implementation Plan: Email Provider Abstraction

**Branch**: `001-email-provider-abstraction` | **Date**: 2026-09-26 | **Spec**: [spec.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/spec.md)

**Input**: Feature specification from `specs/001-email-provider-abstraction/spec.md`

## Summary

Build a swappable `EmailModule` behind an `EmailProvider` interface with a `send(to, subject, body)` contract. Ship SendGrid as the only working adapter; all other providers (`smtp`, `mailgun`, `postmark`, `ses`) throw "not implemented" at boot. The module is `@Global()`, follows the same DI pattern as `RedisModule` and `DatabaseModule`, validates provider credentials via conditional Zod refinements (fail-fast at boot), and logs each send at info/warn level. The SendGrid adapter enforces a 10-second HTTP timeout.

## Technical Context

**Language/Version**: TypeScript (ESM, `"type": "module"`), Node >= 22.12

**Primary Dependencies**: NestJS 12 (`@nestjs/common`, `@nestjs/config`), `@sendgrid/mail` v8.x (new), `zod` v4 (existing)

**Storage**: N/A — no database tables for this feature

**Testing**: Vitest (`*.spec.ts` for unit tests), `@nestjs/testing` for DI integration tests

**Target Platform**: Linux server (Railway production), Docker Compose local dev

**Project Type**: NestJS REST API module within pnpm monorepo

**Performance Goals**: SendGrid HTTP call timeout: 10 seconds max. No performance targets for throughput (email is fire-and-forget from the API's perspective).

**Constraints**: ESM — all relative imports require `.js` extension. SWC build (`nest build -b swc`) skips type checking. The `@sendgrid/mail` package must be compatible with ESM/Node 22.

**Scale/Scope**: Low volume — password-reset and temporary-password emails only in M1. No bulk email use case.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Build Order | ✅ Pass | No change to build chain. `@alfahd/types` is not affected. |
| II. ESM + Drizzle Stack | ✅ Pass | All new files use `.js` imports. No ORM involvement. No CJS. |
| III. Strict Quality Gates | ✅ Pass | New module includes unit tests. Pre-commit hook chain unaffected. |
| IV. Soft-Delete Everywhere | ✅ N/A | No database tables introduced in this feature. |
| V. Split Deployment | ✅ Pass | API-only change. No impact on Vercel or mobile deployments. |
| No Over-Engineering | ✅ Pass | Minimal abstraction — one interface, one working adapter, stubs for the rest. No template system, no retry logic, no queuing. |

**Pre-Phase 0 Blockers**: None. This feature has no dependency on any open OI items.

**Post-Phase 1 Re-check**: Confirmed — no violations introduced by the design.

## Project Structure

### Documentation (this feature)

```text
specs/001-email-provider-abstraction/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── email-provider.md
└── tasks.md             # Phase 2 output (/speckit-tasks - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/src/email/
├── adapters/
│   └── sendgrid.adapter.ts    # SendGrid implementation (only working adapter)
├── email-provider.interface.ts # EmailProvider interface + SendEmailOptions type + token
├── email.module.ts             # @Global() module with factory provider
├── email.module.spec.ts        # Unit tests
└── email.service.ts            # Thin facade injecting EMAIL_PROVIDER token
```

**Modified files**:
- `apps/api/src/config/env.validation.ts` — conditional Zod refinements for provider credentials
- `apps/api/src/app.module.ts` — import `EmailModule`
- `apps/api/.env.example` — add `SENDGRID_API_KEY=`
- `apps/api/package.json` — add `@sendgrid/mail` dependency

**Structure Decision**: Follows the established pattern — `RedisModule` has `redis.module.ts` + `redis.module.spec.ts` in `src/redis/`; `DatabaseModule` has `database.module.ts` in `src/database/`. The email module mirrors this with `src/email/`, adding an `adapters/` subdirectory for future extensibility (one file per provider).

## Complexity Tracking

> No Constitution Check violations. This table is intentionally empty.
