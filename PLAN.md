# alfahd-ems — Master Implementation Plan

**Client:** الفهد جروب (Egyptian ISP/telecom) · **Governing docs:** SoW (binding, governs scope disputes) + SRS v0.1 (draft, superseded wherever it conflicts with the SoW)
**Author:** Marwan (backend) · **Status:** M1 in progress, M2 drafted, M3–M5 derived below for the first time

---

## 0. How to use this file with spec-kit

This is **not** a single spec-kit `plan.md` for one feature — it's the project-level backlog that each milestone's spec-kit cycle should be generated from. Practical flow:

1. For each milestone (M1…M5) below, run `/specify` with that milestone's issue list as the seed content → produces `specs/m{n}-{name}/spec.md`.
2. Run `/plan` against that spec → spec-kit generates the per-feature `plan.md` (Technical Context, Constitution Check, Project Structure, Phase 0/1 research + design). Point it at **§1 Technical Context** below so it doesn't re-derive your stack from scratch or invent alternatives — all major choices below are locked, never let an agent re-litigate them.
3. Run `/tasks` to get `tasks.md` — this should map close to 1:1 onto the numbered issues under each milestone here, since those are already written at task granularity.
4. Whichever agent you hand implementation to, feed it the acceptance criteria verbatim — they're written as testable assertions on purpose.

Do **not** treat M3–M5's issue numbers below as final GitHub issue numbers. They're sequential placeholders for planning; your real repo has already diverged from even the M1/M2 numbering (see §2 note).

---

## 1. Technical Context (feed this to spec-kit's Constitution Check)

| Layer          | Choice                                                                                                                   | Locked because                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend        | NestJS 12 + TypeScript, **ESM** (`"type": "module"`)                                                                     | Already built this way; all relative imports use `.js` extension; SWC compiler via `nest build -b swc`. Never switch to CJS — it breaks AGENTS.md rules and existing imports. |
| ORM / DB       | **Drizzle ORM** (`drizzle-orm` + `pg`), PostgreSQL 16                                                                    | Already in use — `drizzle.config.ts`, schema in `src/database/schema/`, migrations in `apps/api/drizzle/`. Never let an agent suggest Prisma; the decision is closed.         |
| Queue / Cache  | Redis + BullMQ                                                                                                           | Report generation and background jobs must never run on the request thread (NFR-02)                                                                                           |
| Auth           | `@nestjs/passport` + `@nestjs/jwt`, bcrypt cost 12, refresh tokens in Redis, custom guards                               | Better Auth was evaluated and rejected — cookie-first design conflicts with React Native's bearer-token flow, and RBAC model didn't map cleanly                               |
| Real-time      | Socket.io + Redis adapter                                                                                                | Multi-instance WebSocket support for live tracking                                                                                                                            |
| Storage        | **Cloudinary**                                                                                                           | Object storage for employee photos, ticket photos, report exports                                                                                                             |
| Email          | **Nodemailer**                                                                                                           | Password reset and notification emails; simpler setup than SendGrid for this scale                                                                                            |
| Push           | Firebase Cloud Messaging                                                                                                 | Android-first                                                                                                                                                                 |
| Web            | Next.js on **Vercel**                                                                                                    | Owned by a separate frontend dev, not Marwan. API contract freeze in M4 #54 is the hard dependency.                                                                           |
| Mobile         | React Native + Expo (EAS Starter), Android only this phase                                                               | iOS deferred, at additional cost, future phase                                                                                                                                |
| Maps           | Leaflet.js + OpenStreetMap                                                                                               | Avoids per-request Google Maps cost                                                                                                                                           |
| Infra          | **API/DB/Redis on Railway** (staging/prod) · **Web on Vercel** · local Docker Compose (postgres:16, redis:7-alpine)      | Railway for backend services; Vercel for web dashboard                                                                                                                        |
| Monorepo       | pnpm workspaces, no Turborepo/Nx                                                                                         | Team too small to justify it; shared types in `packages/types` (`@alfahd/types`)                                                                                              |
| Access control | CODEOWNERS + branch protection so frontend dev can't merge to `apps/api/` or `packages/types/` without Marwan's approval | —                                                                                                                                                                             |

**Standing engineering rule:** no over-engineering. Ask before making a decision not covered by SoW/SRS/this plan rather than assuming.

---

## 2. Locked Decisions vs. SRS Open Items — reconciled

The SRS lists 13 open items (§7, OI-01…OI-13) as blockers. As of now, several were resolved during M1/M2 build but **the SRS document itself was never updated** — anyone reading it cold would think these are still open. Fix that document, or at minimum don't let an AI agent re-ask questions you've already answered.

| #       | SRS says                                         | Actual status                     | Resolution / source                                                                                                                                                                   |
| ------- | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OI-01 ★ | Total dev fee (EGP) blank                        | **RESOLVED**                      | Client signature confirmed on a separate file (not the uploaded SoW/SRS doc). Agreement is valid and signed.                                                                          |
| OI-02 ★ | Department enum values                           | **RESOLVED**                      | `TECHNICAL, CUSTOMER_SERVICE, WAREHOUSE, MANAGEMENT` — already in schema                                                                                                              |
| OI-03   | Check-in cutoff / check-out requirement          | **RESOLVED**                      | Cutoff = configurable env var, default 09:00, flags `LATE`. Check-out has **no GPS requirement** — works from anywhere, technicians aren't required to return to base.                |
| OI-04   | Ticket priority model (enum vs SLA)              | **RESOLVED by SoW**               | SoW §2.1.12 already fixes it: `Low / Medium / High / Urgent` enum. SRS FR-TK and OI-04 were never updated to match — the SRS is asking a question the governing SoW already answered. |
| OI-05   | Morning batch schedule (exact run/confirm times) | **STILL OPEN**                    | Algorithm + CS-review flow is locked; the clock times are not. Needed before the BullMQ cron can be written.                                                                          |
| OI-06   | Router assignment: automatic vs manual           | **RESOLVED**                      | Manual, by Warehouse Manager only (M2 #24)                                                                                                                                            |
| OI-07   | Non-router inventory items                       | **RESOLVED**                      | Scope is **routers only**. Client has signed off. SoW §2.1.6's broader catalog language is explicitly excluded from this project; no change request needed.                           |
| OI-08   | Subscription plan model (label vs. logic)        | **STILL OPEN**                    | Affects CRM data model in M4                                                                                                                                                          |
| OI-09   | IPv4 only vs IPv6                                | **LARGELY MOOT**                  | Schema uses Postgres `INET`, which natively supports both — but confirm scope/UI expectations regardless                                                                              |
| OI-10   | GPS polling interval on mobile                   | **STILL OPEN**                    | Battery/data tradeoff, needed before M3 tracking work                                                                                                                                 |
| OI-11   | Concurrent user peak estimate                    | **STILL OPEN**                    | Needed for Railway instance sizing                                                                                                                                                    |
| OI-12   | Data retention (tickets, GPS, audit logs)        | **STILL OPEN**                    | Affects M3 route-history storage and general DB cost                                                                                                                                  |
| OI-13   | Mobile dev ownership (Marwan vs. recruited)      | **STILL OPEN**                    | Directly affects M5 timeline/capacity                                                                                                                                                 |

---

## 3. Milestone Map

### Note on current repo state

Per your own tracking: the live repo has 18 issues, not the 27 drafted across M1+M2 below, and the numbering/order has already drifted (a "CI fix" and "foundation hardening" issue exist in the real repo with no equivalent here). **Reconcile the drift before feeding this to an agent as ground truth** — an agent trusting this document over your actual GitHub state will create duplicate or conflicting issues.

---

### M1 — Foundation

_13 issues · ~3–4 weeks · 25% payment · labels: `setup` `infra` `database` `auth` `rbac` `api`_

| #   | Title                                                                                     | Label    |
| --- | ----------------------------------------------------------------------------------------- | -------- |
| 1   | Initialize NestJS project + repo (Zod-validated env, global exception filter/interceptor) | setup    |
| 2   | PostgreSQL + Prisma on Railway (dev/staging envs)                                         | infra    |
| 3   | Redis on Railway (ioredis + BullMQ module)                                                | infra    |
| 4   | SendGrid email service                                                                    | infra    |
| 5   | Core schema + ERD (`users`, `warehouses` stub)                                            | database |
| 6   | Login endpoint (`POST /auth/login`)                                                       | auth     |
| 7   | Token refresh + logout                                                                    | auth     |
| 8   | Login rate limiting (5/10min per IP)                                                      | auth     |
| 9   | Forgot password + reset flow                                                              | auth     |
| 10  | JWT guard + `@Roles()` decorator + RBAC guard                                             | rbac     |
| 11  | Admin: revoke any user session                                                            | rbac     |
| 12  | User management CRUD (Admin only, no hard delete)                                         | api      |
| 13  | Change own password (all roles)                                                           | api      |

**Key contracts:** access token JWT 15min TTL; refresh token 7-day TTL in Redis (`rt:{userId}:{tokenId}`), httpOnly cookie on web, `expo-secure-store` on mobile. Role enum: `ADMIN | WAREHOUSE_STAFF | CS | TECHNICIAN`. No hard deletes anywhere, ever — soft deactivate only.

_(Full issue bodies/acceptance criteria: see your existing `m1` document — unchanged here.)_

---

### M2 — HR + Supply Chain

_14 issues · ~4–5 weeks · 20% payment · labels: `hr` `supply-chain` `inventory` · Leave management cut per your decision — SoW governs, SRS's leave module does not exist._

| #   | Title                                                                                                                          | Label        |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 14  | Schema: employees (extend users), warehouses (full), routers, router_assignments, ip_addresses, ip_history, attendance_records | database, hr |
| 15  | Employee CRUD (Admin only)                                                                                                     | hr           |
| 16  | Employee profile photo upload (R2, 5MB, jpeg/png)                                                                              | hr           |
| 17  | Cloudflare R2 storage service (generic `uploadFile`)                                                                           | infra        |
| 18  | Attendance check-in (GPS ≤150m Haversine, 09:00 cutoff → LATE flag)                                                            | hr           |
| 19  | Attendance check-out (no GPS requirement)                                                                                      | hr           |
| 20  | Admin manual attendance override (reason required)                                                                             | hr           |
| 21  | Attendance report export (Excel, BullMQ background job)                                                                        | hr           |
| 22  | Warehouse CRUD (block delete if referenced, 409)                                                                               | supply-chain |
| 23  | Router CRUD + enforced status transitions                                                                                      | supply-chain |
| 24  | Manual router assignment to technician                                                                                         | supply-chain |
| 25  | Router inventory report per warehouse                                                                                          | supply-chain |
| 26  | IP address CRUD + bulk CSV import                                                                                              | supply-chain |
| 27  | IP history log (audit trail)                                                                                                   | supply-chain |

**Deferred dependency flagged in #14:** `ip_addresses.customer_id` references a table (`customers`) that doesn't exist until M4 — use a plain UUID column without an FK constraint for now; formalize the FK in M4 (#43 below). This pattern **must repeat** for tickets in M3 — see next section.

**Unresolved (§5 Risk 1):** this milestone builds router lifecycle only. If the SoW's generic item/catalog inventory module (§2.1.6) is truly in scope, it is missing entirely from this milestone and has no home in M3–M5 either. Decide and either add it as a change request or get written client sign-off that routers-only satisfies §2.1.6.

_(Full issue bodies/acceptance criteria: see your existing `m2` document — unchanged here.)_

---

### M3 — Field Operations _(new — derived from SoW §2.1.9–2.1.12, §4.3–4.5 and SRS §3.4)_

_~15 issues · est. 4–5 weeks · 20% payment · labels: `field-ops` `tracking` `notifications`_

**Schema additions (#28):**

- `customers` **(stub only — mirrors the M1→M2 `warehouses` stub pattern)**: `id, name, phone, address, gps_lat, gps_lng, status(enum ACTIVE|INACTIVE|SUSPENDED), created_at`. Full profile (national_id, subscription_plan, secondary phones) lands in M4 — same deferral discipline you already applied to warehouses.
- `tickets`: `id, customer_id(FK→customers), type(enum INSTALLATION|TECHNICAL_ISSUE|COMPLAINT|MAINTENANCE), description, priority(enum LOW|MEDIUM|HIGH|URGENT), status(enum PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED), address, gps_lat, gps_lng, assigned_technician_id(FK, nullable), assigned_at, created_by(FK→users), created_at, completed_at, cancelled_reason(nullable), satisfaction_rating(1-5, nullable)`
- `ticket_status_history`: `id, ticket_id(FK), from_status, to_status, actor_id(FK), created_at`
- `ticket_photos`: `id, ticket_id(FK), url, uploaded_at`
- `technician_locations`: latest-position cache per technician (`technician_id, lat, lng, updated_at`)
- `ticket_routes`: point-in-time GPS samples per ticket while "In Progress" (`id, ticket_id, lat, lng, recorded_at`) — **retention policy is OI-12, still open; don't build unbounded storage without an answer**
- `device_tokens`: `id, user_id(FK), token, platform, created_at` — FCM registration

| #   | Title                                                                                                                                                     | Label               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 28  | Schema: customers stub, tickets, ticket_status_history, ticket_photos, technician_locations, ticket_routes, device_tokens                                 | database, field-ops |
| 29  | Ticket CRUD (CS creates/reads/updates; fields per SoW §2.1.12)                                                                                            | field-ops           |
| 30  | Ticket status transitions, no-skip enforced (Pending→Assigned→In Progress→Completed/Cancelled)                                                            | field-ops           |
| 31  | Photo upload on completion — mandatory for Installation, optional for Maintenance/Complaint                                                               | field-ops           |
| 32  | Ticket cancellation with reason at any status, full history retained                                                                                      | field-ops           |
| 33  | On installation ticket close: auto-trigger router status → Installed at Customer + IP status → Assigned (integration with M2 #23/#26)                     | field-ops           |
| 34  | Morning batch suggestion algorithm: proximity (technician home warehouse ↔ ticket cluster) + load balance, **exclude technicians with `status=ON_LEAVE`** | field-ops           |
| 35  | Morning batch CS review/confirm screen endpoint — technicians notified **only** after CS confirms                                                         | field-ops           |
| 36  | Manual assign/reassign endpoint for urgent/overflow, any time, any status; notifies both old and new technician                                           | field-ops           |
| 37  | Mobile GPS ping ingestion via WebSocket (Socket.io + Redis adapter), only while ticket "In Progress" or technician checked in                             | tracking            |
| 38  | Live technician map channel/endpoint for Admin/CS/Ops (online/offline indicator, last-update timestamp)                                                   | tracking            |
| 39  | Historical route storage per ticket — **blocked on OI-12 retention decision**                                                                             | tracking            |
| 40  | FCM device token registration endpoint                                                                                                                    | notifications       |
| 41  | Push notifications: morning batch confirmed, manual urgent assignment, reassignment (to both parties)                                                     | notifications       |
| 42  | CS manually logs customer satisfaction rating (1–5) post-closure                                                                                          | field-ops           |

**Acceptance criteria highlights:**

- Skipping a status (e.g. Pending → Completed directly) → 400.
- Installation ticket cannot be marked Completed with zero photos attached → 400.
- Morning batch suggestions exclude `ON_LEAVE` technicians even though the Leave module itself doesn't exist — this only works because the enum value survived the scope cut (per decisions log).
- Reassignment always fires two notifications, not one.

**Blockers before this milestone can start cleanly:** OI-05 (batch schedule times), OI-10 (GPS polling interval), OI-12 (retention policy). Building `ticket_routes` (#39) without OI-12 answered risks unbounded storage growth you can't cost.

---

### M4 — CRM + Reports + Dashboard _(new — derived from SoW §2.1.11, §2.1.13 and SRS §3.5, §3.7)_

_~13 issues · est. 3–4 weeks · 20% payment · labels: `crm` `reports` `dashboard`_

**Schema additions (#43):**

- `customers`: extend stub with `national_id, subscription_plan(TBD — OI-08), created_at` finalized
- `customer_phones`: secondary numbers, if "phone number(s)" plural in SoW §2.1.11 is taken literally rather than one field
- **Formalize deferred FKs**: `ip_addresses.customer_id → customers.id` (deferred from M2 #14), `tickets.customer_id → customers.id` (deferred from M3 #28)
- `report_jobs`: `id, type, params(jsonb), status, file_url, requested_by(FK), created_at` — backs every background-export endpoint

| #   | Title                                                                                                                                                                | Label         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 43  | Full customer schema + add the two deferred FK constraints                                                                                                           | database, crm |
| 44  | Customer CRUD (Admin/CS), full profile                                                                                                                               | crm           |
| 45  | Customer search (name, phone, national ID, IP address)                                                                                                               | crm           |
| 46  | Customer ticket history endpoint                                                                                                                                     | crm           |
| 47  | Customer average satisfaction rating (computed across all closed tickets)                                                                                            | crm           |
| 48  | On customer deactivation: auto-release assigned IP to Available (FR-CRM-07)                                                                                          | crm           |
| 49  | Report job infrastructure: `report_jobs` table, generic BullMQ job runner, `GET /jobs/:id` status                                                                    | reports       |
| 50  | Technician performance report (completion rate, avg response time, rating, first-visit resolution, tickets/day, late check-ins)                                      | reports       |
| 51  | Ticket summary report (Excel + PDF)                                                                                                                                  | reports       |
| 52  | Finalize router/IP reports with PDF export where the report type calls for it                                                                                        | reports       |
| 53  | Admin dashboard summary endpoints (employee/attendance/ticket/inventory/router KPI snapshot)                                                                         | dashboard     |
| 54  | API contract freeze + OpenAPI/Swagger doc handoff to the Next.js frontend dev                                                                                        | dashboard     |
| 55  | System configuration endpoints (shift hours, GPS radius, low-stock thresholds) — Admin only                                                                          | dashboard     |
| 56  | Customer GPS capture via CS map-picker (Leaflet) — **required, not optional**, per your locked override of the SRS; WhatsApp location-link parsing as secondary path | crm           |

**Note:** #54 is a real dependency, not paperwork — if the frontend developer is building against a moving API, expect churn. Freeze the contract before M4 implementation starts, not after.

---

### M5 — Mobile App + QA + Handover _(new — derived from SoW §2.2, §11–14 and SRS §8)_

_~14 issues · est. 3–4 weeks · 15% payment · labels: `mobile` `qa` `deployment`_

| #   | Title                                                                                                                    | Label      |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 57  | Expo project scaffold, navigation, secure token storage (`expo-secure-store`)                                            | mobile     |
| 58  | Login screen + forgot-password flow                                                                                      | mobile     |
| 59  | Home screen: attendance status, working-hours counter, task summary                                                      | mobile     |
| 60  | Attendance check-in/check-out screens (GPS on check-in only)                                                             | mobile     |
| 61  | My Tasks: tabbed list (All/Pending/In Progress/Completed) + detail view, read-only customer/router/IP fields             | mobile     |
| 62  | Start/Complete task actions + mandatory photo upload for installation tickets                                            | mobile     |
| 63  | Push notification handling (FCM) + deep link into the relevant task                                                      | mobile     |
| 64  | Offline check-in caching + sync on reconnect (NFR-10)                                                                    | mobile     |
| 65  | Profile screen: view details, change password, logout                                                                    | mobile     |
| 66  | Full E2E test pass across all modules against staging                                                                    | qa         |
| 67  | Load/perf validation against NFR-01/NFR-02 (API p95 < 500ms; report jobs < 60s for 12-month datasets)                    | qa         |
| 68  | Production deployment: Railway (API/DB/Redis/Workers) + Vercel (dashboard) + EAS build; full credential handover package | deployment |
| 69  | Admin training session + technical documentation handoff                                                                 | deployment |
| 70  | 30-day bug-fix warranty window: tracking + triage process kickoff                                                        | deployment |

**Blocker:** OI-13 (mobile dev ownership) directly determines whether this milestone is Marwan's own timeline or someone else's — resolve before estimating M5 duration to a client.

---

## 4. Cross-Milestone Schema Evolution (quick reference for an agent)

| Table                                                 | Introduced     | Extended                                            | Deferred FK resolved     |
| ----------------------------------------------------- | -------------- | --------------------------------------------------- | ------------------------ |
| `users`                                               | M1 (#5)        | M2 (#14: department, national_id, hire_date, photo) | —                        |
| `warehouses`                                          | M1 (#5, stub)  | M2 (#22, full CRUD)                                 | —                        |
| `routers` / `router_assignments`                      | M2 (#14)       | —                                                   | —                        |
| `ip_addresses` / `ip_history`                         | M2 (#14)       | —                                                   | M4 (#43: FK → customers) |
| `attendance_records`                                  | M2 (#14)       | —                                                   | —                        |
| `customers`                                           | M3 (#28, stub) | M4 (#43, full)                                      | —                        |
| `tickets` / `ticket_status_history` / `ticket_photos` | M3 (#28)       | —                                                   | M4 (#43: FK → customers) |
| `technician_locations` / `ticket_routes`              | M3 (#28)       | —                                                   | —                        |
| `device_tokens`                                       | M3 (#28)       | —                                                   | —                        |
| `report_jobs`                                         | M4 (#49)       | —                                                   | —                        |

The stub-then-extend pattern used for `warehouses` (M1→M2) is deliberately repeated for `customers` (M3→M4). Don't let an agent "clean this up" by building the full `customers` table early in M3 — that pulls M4 scope forward and blurs the payment-milestone boundaries your contract is priced against.

---

## 5. Risks worth resolving before you generate specs from this document

1. **OI-05, OI-10, OI-12 all block concrete M3 implementation decisions** (cron schedule, GPS polling battery/data tradeoff, and route-history retention/cost). None of these are "nice to know later" — they change actual code you'd write in #34, #37, #39.
2. **Repo/document drift (§3 note).** Your live GitHub issues have already diverged from the M1/M2 lists that this plan is built on. Reconcile before an agent trusts this file as current state.

---

## 6. Infrastructure & DevOps Backlog _(absorbed from former FUTURE.md — now the single source of truth)_

These items are not feature milestones and don't map to GitHub issues, but they are required before
or alongside specific milestones. Do not omit them when planning sprint capacity.

### 6.1 — API Dockerfile _(before M5 #68, i.e. before production deployment)_

Multi-stage build: `builder` stage installs pnpm via corepack, builds `@alfahd/types` then
`@alfahd/api` via SWC; `runner` stage copies only `dist/`, production `node_modules`, and
`package.json` files. Non-root user (`alfahd:1001`). Port exposed from env (default 3000).

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

**Verification:** `docker build -f apps/api/Dockerfile .` → `docker run -p 3000:3000 --env-file apps/api/.env alfahd-api` → API responds on `http://localhost:3000`.

---

### 6.2 — CI pnpm Store Caching _(after CI workflow is confirmed green)_

Add to both `.github/workflows/ci.yml` and `deploy-api.yml`, immediately after the `Setup pnpm` step:

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

Expected speedup: 2–3× on cache hits.

---

### 6.3 — Dependabot Configuration _(after repo is pushed to GitHub)_

File: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels: ["dependencies"]
    groups:
      nestjs:
        patterns: ["@nestjs/*"]
      drizzle:
        patterns: ["drizzle-orm", "drizzle-kit"]
      typescript:
        patterns: ["typescript"]
      eslint:
        patterns: ["eslint*", "@eslint/*"]

  - package-ecosystem: "npm"
    directory: "/apps/api"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels: ["dependencies"]

  - package-ecosystem: "npm"
    directory: "/packages/types"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 5
    labels: ["dependencies"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels: ["ci"]
```

---

### 6.4 — Structured Logging with pino _(M1 scope, do alongside #1)_

Install `nestjs-pino` + `pino-pretty` (dev only). Configure as the global logger in `AppModule`.
Log level controlled via env var (`LOG_LEVEL`, default `info`). Do not use NestJS's default
`ConsoleLogger` in production — it has no structured output.

```bash
pnpm --filter @alfahd/api add nestjs-pino pino-http
pnpm --filter @alfahd/api add -D pino-pretty
```

---

### 6.5 — CORS Configuration _(M1 scope, do in `main.ts` alongside #1)_

Enable CORS in `main.ts` with an allowlist driven by an env var (`CORS_ORIGINS`, comma-separated).
The web dashboard origin (Vercel) and the local dev origin must both be allowed. The mobile app
uses bearer tokens, not cookies, so it is not affected by CORS.

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3001"],
  credentials: true,
});
```
