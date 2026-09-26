# Alfahd-EMS Constitution

## Core Principles

### I. Shared Contracts First
`@alfahd/types` is the single source of truth for all API contracts shared between the backend,
web dashboard, and mobile app. A breaking change to any exported type MUST fail the dependents'
TypeScript build before any code reaches main. This is enforced by the monorepo build order:
types build → api build → web build. No agent may weaken or skip this chain.

### II. ESM + Drizzle Stack — Non-Negotiable
The backend runs NestJS 12 with `"type": "module"` (ESM). All relative imports inside `apps/api/`
MUST carry the `.js` extension. The ORM is Drizzle (`drizzle-orm` + `pg`); migrations live in
`apps/api/drizzle/`; the schema lives in `apps/api/src/database/schema/`. Neither the module
system nor the ORM is open for reconsideration — do not propose CJS or Prisma.

### III. Strict Quality Gates
Every push must pass the full pre-commit hook chain: types build → api typecheck → format →
lint → unit tests. GitHub Actions CI is the final gate: it runs the same chain plus e2e tests
and `pnpm audit`. Bypassing hooks or silencing CI failures is never acceptable.

### IV. Soft-Delete Everywhere, No Exceptions
No row in any table is ever hard-deleted. All entities use a soft-deactivation pattern
(an `is_active` flag or a `deleted_at` timestamp). This applies to users, employees, customers,
routers, IP addresses, tickets — everything. Any migration that adds a `DELETE` path to a
production table requires an explicit constitution amendment.

### V. Split Deployment, Single Repo
API, PostgreSQL, Redis, and background workers deploy to **Railway**. The web dashboard
(Next.js) deploys to **Vercel** and is owned by a separate frontend developer. The mobile app
(React Native + Expo) builds via EAS. All three surfaces share the same monorepo but have
independent deployment pipelines. An API contract freeze (M4 #54) gates the frontend dev's work —
breaking the contract without a version bump is a release blocker.

## Technology Stack Constraints

**Backend**
- Runtime: Node >= 22.12, ESM (`"type": "module"`)
- Framework: NestJS 12, SWC compiler (`nest build -b swc`, `nest start --watch -b swc`)
- ORM: Drizzle ORM + `pg` driver, PostgreSQL 16
- Validation: `class-validator` + `class-transformer`; env validation via Zod + `@nestjs/config`
- Auth: `@nestjs/passport` + `@nestjs/jwt`; bcrypt cost 12; refresh tokens in Redis; custom RBAC guards
- Queue: BullMQ + ioredis (Redis 7)
- Real-time: Socket.io + Redis adapter (multi-instance WebSocket)
- Testing: Vitest (unit: `*.spec.ts`, e2e: `*.e2e-spec.ts`)

**External Services**
- Object storage: **Cloudinary** (employee photos, ticket completion photos, report exports)
- Email: **Nodemailer** (password reset, notifications)
- Push notifications: **Firebase Cloud Messaging** (Android-first; iOS deferred)
- Maps: Leaflet.js + OpenStreetMap (web dashboard only; avoids Google Maps per-request cost)

**Monorepo**
- Package manager: pnpm workspaces (no Turborepo/Nx — team size doesn't justify it)
- Shared types: `packages/types` (`@alfahd/types`) — ESM, built before any consumer
- Access control: CODEOWNERS + branch protection; frontend dev cannot merge to `apps/api/` or
  `packages/types/` without Marwan's review

**Infrastructure**
- Production/Staging: Railway (API, PostgreSQL 16, Redis 7, BullMQ workers)
- Web dashboard: Vercel
- Mobile: Expo EAS (Android target; iOS is a future paid phase)
- Local dev: Docker Compose (`postgres:16`, `redis:7-alpine`)

## Development Workflow

- **Build order**: Always `pnpm --filter @alfahd/types build` before anything that imports it.
- **Dev server**: `pnpm api:dev` (builds types first, then `nest start --watch -b swc`).
- **Branch management**: Rebase onto `master` (`git rebase origin/master`); merge commits are
  forbidden — they break GitHub's rebase button and CI history.
- **Commit messages**: Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) with a
  useful what/why body. Never vague (`fix stuff`, `update`).
- **Pre-commit hook chain**: types build → api typecheck → format → lint → unit tests. All must
  pass before push; never bypass with `--no-verify`.

## Pre-Phase Blockers (Open Questions)

These questions are unresolved. **No `/speckit-tasks` run, no implementation, and no schema
migration may start for the blocking milestone until the relevant question is answered and this
section is updated.** When resolving a question, change its status to `RESOLVED`, record the
decision inline, and bump this constitution by at least a PATCH version.

| ID    | Blocks          | Question                                                                                                                        | Why it cannot be deferred                                                                                                                                                  | Status   |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| OI-05 | M3 #34, #35     | What are the exact clock times for the morning batch run and the CS-confirm deadline?                                           | The BullMQ cron expression and the confirmation window endpoint cannot be written without concrete times.                                                                   | **OPEN** |
| OI-08 | M4 #43, #44     | Is `subscription_plan` a free-text label or a typed enum with business logic (e.g. speed tier, billing cycle)?                  | Determines whether it is a `varchar` column or a relational `subscription_plans` table. Wrong choice = a breaking migration later.                                          | **OPEN** |
| OI-10 | M3 #37          | What is the GPS ping interval on mobile while a ticket is In Progress?                                                          | Sets the Socket.io emit rate, Redis write rate, and battery/data consumption — directly affects mobile UX spec and infrastructure cost.                                     | **OPEN** |
| OI-11 | M5 #67, M5 #68  | What is the expected peak concurrent user count?                                                                                | Required to size Railway instances and set BullMQ worker concurrency before load testing (M5 #67) and production deployment (M5 #68).                                       | **OPEN** |
| OI-12 | M3 #39          | What is the data retention policy for `ticket_routes` GPS samples, ticket photos, and audit logs?                               | Without a policy, `ticket_routes` grows unbounded. Must be answered before building #39 to avoid an immediate storage cost problem.                                         | **OPEN** |
| OI-13 | M5 (all issues) | Is the mobile app built by Marwan or a recruited developer?                                                                     | Directly determines M5 capacity, timeline, and handover scope. An external dev needs onboarding time not accounted for in any current milestone estimate.                   | **OPEN** |

## Governance

This constitution supersedes all ad-hoc practices. `AGENTS.md` handles day-to-day operational
rules (commands, gotchas, env); this document handles architectural principles and stack decisions.
When the two conflict, resolve by amending this document first, then updating `AGENTS.md`.

**Amendment procedure:**
1. Open a PR with the proposed constitution change and rationale.
2. The change must not be merged until `AGENTS.md` and any relevant milestone specs are updated
   to match.
3. Increment `CONSTITUTION_VERSION` per semver rules (MAJOR = principle removal or redefinition;
   MINOR = new principle or section; PATCH = clarification or wording).

**Payment milestones** (M1-M5 defined in `PLAN.md`) gate client payments; do not merge a
milestone-closing PR without client sign-off on that milestone's acceptance criteria.

**No over-engineering rule:** When a decision is not covered by the SoW, SRS, `PLAN.md`, or this
constitution, ask before assuming. Default to the simplest approach that satisfies the spec.

**Version**: 2.1.0 | **Ratified**: 2026-09-26 | **Last Amended**: 2026-09-26
