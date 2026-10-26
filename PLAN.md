# alfahd-ems — Master Implementation Plan

**Client:** الفهد جروب (Egyptian ISP/telecom) · **Governing docs:** SoW (binding, unsigned as of v1.0) + SRS v0.1 (draft; superseded wherever it conflicts with the SoW)
**Author:** Marwan (backend)

Implementation ground truth for spec-kit. Every phase states what it must produce, how to know it is done, and the specific ways a cheaper model will plausibly get it wrong. Feed each phase section to `/specify` as-is. Sources were re-checked against SoW v1.0, SRS v0.1, m1 and m2 on 2026-10-08.

**Parallel execution (added 2026-10-22):** §3 was written for one developer. §6–§7 override the serial reading of §3 without changing any milestone's scope, DoD or "bad shape" tests: work-scheduling runs in waves across named streams, and each milestone has a `_Lanes_` line mapping its issues to streams. If a section of §3 and §6–§7 ever conflict, milestone scope always wins over scheduling.

---

## 1. Constitution — locked across every phase

| Layer                  | Choice                                                                                                                                             | Rule for the agent                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Backend                | NestJS + TypeScript, **ESM**, compiled with **SWC**                                                                                                | Do not "fix" problems by switching to CJS. See ESM/SWC rules below.                                                          |
| ORM / DB               | Drizzle ORM `^0.45.2` + drizzle-kit `^0.31.10` (legacy journal layout), PostgreSQL                                                                  | Keep compatible semver ranges rather than exact pins; resolve installs through the pnpm lockfile. Drizzle v1 is out of scope until a recorded decision. Prisma is not used; never add it. |
| Queue / Cache          | Redis + BullMQ                                                                                                                                     | Background work never runs on the request thread.                                                                            |
| Auth                   | `@nestjs/passport` + `@nestjs/jwt`, **argon2id** (`argon2` package), refresh tokens in **Redis**, custom guards                                    | bcrypt is not used. Library-default argon2id parameters unless benchmarked on the target host; do not hand-tune from memory. |
| Enums                  | **No TypeScript `enum` keyword.** `as const` tuples in `packages/types`, union types derived from them, Drizzle `pgEnum` built from the same tuple | One tuple = one source of truth for API, DB and mobile. Enforce with ESLint `no-restricted-syntax` on `TSEnumDeclaration`.   |
| Real-time              | Socket.io + Redis adapter                                                                                                                          | Multi-instance support is a requirement.                                                                                     |
| Storage / Email / Push | Cloudflare R2 · SendGrid · FCM                                                                                                                     | —                                                                                                                            |
| Mobile                 | React Native + Expo (EAS Starter), Android only                                                                                                    | iOS is a separately priced future phase.                                                                                     |
| Maps                   | Leaflet.js + OpenStreetMap                                                                                                                         | No Google Maps.                                                                                                              |
| Infra                  | **Docker Compose locally** (postgres:16, redis:7-alpine). Railway deploy is deferred to the deploy gate before M4a                                 | Nothing before the gate may require Railway to work.                                                                         |
| Monorepo               | pnpm workspaces, no Turborepo/Nx; shared code in `packages/types` (`@alfahd/types`)                                                                | `@alfahd/types` stays runtime-light: no Nest, Drizzle or Node-only imports, so Metro can consume it.                         |

```ts
// packages/types — the pattern, not the only file
export const ROLES = ["ADMIN", "WAREHOUSE_STAFF", "CS", "TECHNICIAN"] as const;
export type Role = (typeof ROLES)[number];
// apps/api schema: export const roleEnum = pgEnum('role', ROLES);
```

A Postgres enum value can be added by migration but not cleanly removed or renamed. The router status set is the one most likely to change (SoW §7 still lists "additional router statuses" as pending client confirmation).

**ESM/SWC rules — violating any is "not done":**

- SWC has no type checker. `tsc --noEmit` (e.g. `pnpm --filter api typecheck`) must pass alongside the build; a green SWC build proves nothing about types.
- SWC config must enable legacy decorators and `decoratorMetadata`; Nest DI depends on it.
- Circular imports between providers/modules can fail at boot under ESM with "Cannot access 'X' before initialization". Remove the cycle (or use `forwardRef`); do not paper over it.
- Relative imports must resolve under the configured module resolution (explicit extensions where required).

**Global rules — any violation is an automatic "not done":**

- No hard deletes. Soft deactivate or status flag only.
- RBAC enforced server-side in guards; a client-side-only check is not RBAC.
- GPS distance, timestamps and totals are computed server-side, never trusted from the client.
- File generation, bulk email and bulk row processing run as BullMQ jobs.
- Every migration is safe to run against rows that already exist in that table.
- Migrations: a branch rebases on master, deletes its own generated migration and snapshot, and regenerates with `drizzle-kit generate --name <slug>`. Never merge or hand-edit `meta/_journal.json` or snapshot files.
- Redis key discovery uses `SCAN`, never `KEYS`.
- No invented business logic. If a rule is not in this file, the SoW or the SRS, stop and ask.

---

## 2. Decisions

### 2a. SoW vs SRS vs issue docs — resolved (SoW governs)

| Topic             | Conflict                                                                                                        | Locked decision                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles             | SRS lists 6 roles; SoW lists 4                                                                                  | 4 roles: `ADMIN, WAREHOUSE_STAFF, CS, TECHNICIAN`. m2 says "Warehouse Manager" for router/IP actions: there is no such role. Use `WAREHOUSE_STAFF` (+ `ADMIN`). |
| GPS ping window   | SoW §2.2.4: continuously while checked in. SRS FR-RT-02: while ticket In Progress                               | Ping while checked in (SoW). Tag each point with the active ticket id when one is In Progress, so per-ticket routes (SRS FR-RT-04) still work.                  |
| Avg response time | SoW §3: ticket creation → technician arrival. SRS §3.2.4: assignment → In Progress                              | SoW. "Arrival" = first transition to In Progress (SoW §4.3: technician marks it on arrival).                                                                    |
| Leave             | SRS has a module; SoW does not                                                                                  | Cut. `users.status` includes `ON_LEAVE` as the lightweight substitute.                                                                                          |
| Password hashing  | SRS NFR-06: bcrypt cost 12. Actual: argon2id                                                                    | argon2id. SoW §8 makes technology the developer's call. Update SRS NFR-06 wording.                                                                              |
| Public routes     | SRS NFR-04: only login/refresh public                                                                           | Four public routes: login, refresh, forgot-password, reset-password (SoW §2.1.1 requires the last two).                                                         |
| IP history        | m2 #14 gives `ip_history.action` only `ASSIGNED \| RELEASED`; #27 needs a row for retire and manual changes too | Every status mutation writes one row recording `from_status` and `to_status`; extend the action set to cover all of them. Fix in the m2 issue.                  |

### 2b. SRS open items

| #     | Topic                       | Status            | Handling                                                                                                       |
| ----- | --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| OI-02 | Department values           | LOCKED            | `TECHNICAL, CUSTOMER_SERVICE, WAREHOUSE, MANAGEMENT` only.                                                     |
| OI-03 | Check-in cutoff / check-out | LOCKED            | Cutoff = env var, default `09:00`, sets `LATE`. Check-out has no GPS check.                                    |
| OI-04 | Ticket priority             | LOCKED            | `LOW, MEDIUM, HIGH, URGENT` (SoW §2.1.12).                                                                     |
| OI-06 | Router assignment           | LOCKED            | Manual by warehouse staff. Never automatic on ticket creation.                                                 |
| OI-09 | IPv4/IPv6                   | MOOT              | `INET` covers both.                                                                                            |
| OI-05 | Morning batch times         | **OPEN**          | Configurable env var, placeholder default, marked provisional. Do not hardcode as settled.                     |
| OI-08 | Subscription plan           | **OPEN**          | Plain label field. No pricing/bandwidth logic.                                                                 |
| OI-10 | GPS polling interval        | **OPEN**          | Configurable constant on the client.                                                                           |
| OI-11 | Peak concurrent users       | OPEN              | Not a coding blocker.                                                                                          |
| OI-12 | GPS/route retention         | **OPEN**          | Conservative provisional default (e.g. 90 days) plus a cleanup job, commented as provisional. Never unbounded. |
| OI-13 | Mobile dev ownership        | OPEN              | Affects M5 schedule, not scope.                                                                                |
| OI-07 | Non-router inventory        | **CONTRADICTION** | See §5 Risk 1.                                                                                                 |

---

## 3. Phases

Each milestone is its own spec-kit cycle (run per stream, in that stream's own worktree — see §6.2 rule 9):

1. `/speckit-specify` (or `/specify`) with that milestone's issue list as the seed content → produces `specs/m{n}-{name}/spec.md`.
2. `/speckit-clarify` (or `/clarify`) against that spec → identifies underspecified areas, asks targeted questions, and encodes answers back into the spec before planning.
3. `/speckit-plan` (or `/plan`) against that spec → generates the per-feature `plan.md` (Technical Context, Constitution Check, Project Structure, Phase 0/1 research + design). Point it at the **§1 Constitution** above so it does not re-derive the stack or invent alternatives — all major choices are locked; never let an agent re-litigate them.
4. `/speckit-checklist` (or `/checklist`) → generates a quality checklist (e.g. under `checklists/`) validating requirements completeness, clarity, consistency and edge cases before generating tasks.
5. `/speckit-tasks` (or `/tasks`) → produces `tasks.md`, which should map close to 1:1 onto the numbered issues for that milestone in §3, since they are already written at task granularity.
6. `/speckit-implement` — feed it the acceptance criteria verbatim; they are written as testable assertions on purpose.

Scheduling is **not** strictly serial any more: §6–§7 define the work-streams, contract cards and waves that run several milestones concurrently. The two hard constraints that survive serial execution are §4 table ownership (never create or extend a later phase's tables early) and the §6.2 shared-surface rules. "Payment %" is the SRS §6 split; see §5 Risk 2.

---

### M1 — Foundation

_13 issues · SRS payment 25%_

**Goal:** bootable NestJS service with working auth and RBAC. Nothing else.

_Lanes: none. M1 closes before Wave 1; Marwan finishes the remaining issues._

**Issues:** scaffold (Zod env validation, global exception filter + response interceptor) · Postgres + Drizzle (Docker) · Redis + BullMQ (Docker) · SendGrid · core schema (`users`, `warehouses` stub) + ERD · login · refresh/logout · login rate limiting · forgot/reset password · JWT guard + `@Roles()` · admin session revoke · user CRUD · change own password.

**Definition of done:**

- `docker compose up` brings up Postgres and Redis; migrations apply on a fresh DB; `start:dev` boots. A missing required env var throws at boot.
- `users`: `role` enum as above; `status` = `ACTIVE | INACTIVE` in this phase; `department` is a nullable VARCHAR (OI-02 not yet applied); `assigned_warehouse_id` FK to the `warehouses` stub.
- Passwords stored as argon2id (hash string starts `$argon2id$`).
- Access token: JWT, 15 min, payload `{ sub, role }`. Refresh token: UUID v4 at `rt:{userId}:{tokenId}`, 7-day TTL, **rotated on every use**; replaying a rotated token → 401. Web: httpOnly+Secure+SameSite=Strict cookie; mobile: response body.
- Wrong password → 401. Unknown email → same 401, and that path still performs an argon2 verify against a dummy hash so timing does not reveal which emails exist. Inactive user → 403.
- `rl:login:{ip}`, TTL 10 min: 6th attempt → 429 with `Retry-After`; a successful login resets the counter.
- Forgot password: token at `pw-reset:{token}`, 15 min TTL, single use. Reset revokes all of that user's refresh tokens.
- Guards applied globally; only the four `@Public()` routes work without a token. No token → 401; wrong role → 403.
- Admin revoke deletes `rt:{userId}:*` via `SCAN`. Deactivate sets `INACTIVE`, revokes sessions, keeps the row.
- Admin creating a user sends a temp-password email. Change-own-password: wrong current → 400; success revokes refresh tokens.

**Bad shape — reject if:**

- Refresh tokens in Postgres, or without TTL, or not rotated.
- Anything other than argon2id for passwords, or bcrypt/Prisma imports anywhere.
- TS `enum` keyword used; role values renamed or added.
- A route reachable without the guards other than the four public ones.
- Hard delete of a user.
- Redis `KEYS` used for session revoke.
- Docs/issues describing Prisma, bcrypt or Railway are treated as instructions (they are stale; see §5 Risk 5).

---

### M2a — HR

_8 issues · SRS payment: M2 20% (shared with M2b)_

**Goal:** employee records and attendance. No supply chain.

_Lanes (other backend developer, Waves 1–2):_ The report-job pipeline is the first issue and freezes the report-pipeline card before the router report starts.

**Issues:** report-job pipeline (first, standalone issue) · schema changes · employee CRUD · photo upload · R2 storage service · check-in · check-out · admin override · attendance Excel export (runs on the pipeline issue above).

**Definition of done:**

- Migration: `users.department` VARCHAR → enum, `users.status` → `ACTIVE | ON_LEAVE | INACTIVE`, plus `national_id`, `hire_date`, `profile_photo_url`; `attendance_records` (`check_in_lat/lng`, `check_out_at` nullable with no GPS columns, `status` `ON_TIME | LATE`). The migration runs cleanly against existing M1 users.
- `PATCH /employees/:id/status` requires a reason, logged. `INACTIVE` revokes sessions; `ON_LEAVE` does **not** (it only affects assignment eligibility later).
- Employee list filters compose (role + department + status together).
- Check-in (`TECHNICIAN`): server Haversine to `assigned_warehouse_id` coordinates; over 150 m → 400 with the distance in the message; second check-in same day with no check-out → 409; after cutoff → `LATE`.
- Check-out: no GPS check; no open check-in → 400.
- Override (`ADMIN`, `PATCH /attendance/:id`): `reason` required, stored with the edit.
- Photo upload: over 5 MB or not jpeg/png → 400 and **nothing written to R2**.
- R2 service: generic `uploadFile(buffer, key, mimeType)`; missing credentials fail at boot.
- Report pipeline: BullMQ job → `exceljs` → R2 → `GET /jobs/:id` status/download URL. A 12-month range does not block other requests. Later reports reuse this pipeline.

**Bad shape — reject if:**

- Distance or "late" decided from client-supplied values.
- Check-out given a GPS requirement "for consistency".
- Report generated synchronously, or the cutoff hardcoded.
- The `department`/`status` migration fails or drops data on existing rows.
- An employee row hard-deleted.
- Report pipeline written report-specific so M2b has to copy it.

---

### M2b — Supply Chain

_7 issues · SRS payment: M2 20% (shared with M2a)_

**Goal:** warehouse, router and IP lifecycle. No tickets, no customers.

_Lanes (other backend developer, Wave 3):_ Starts after M2a's report-pipeline card is frozen. Runs after M2a, not in parallel, because one developer owns it.

**Issues:** schema · warehouse CRUD · router CRUD + transitions · manual router assignment · router inventory report · IP CRUD + bulk CSV import · IP history.

**Definition of done:**

- Router statuses: `AVAILABLE, ASSIGNED_TO_TECHNICIAN, INSTALLED_AT_CUSTOMER, RETURNED, DAMAGED, UNDER_REPAIR, LOST, DECOMMISSIONED`. Allowed transitions, and nothing else:
  `AVAILABLE→ASSIGNED_TO_TECHNICIAN` · `ASSIGNED_TO_TECHNICIAN→INSTALLED_AT_CUSTOMER|RETURNED|DAMAGED|LOST` · `INSTALLED_AT_CUSTOMER→RETURNED` · `RETURNED→AVAILABLE|UNDER_REPAIR|DAMAGED` · `DAMAGED→UNDER_REPAIR|DECOMMISSIONED` · `UNDER_REPAIR→AVAILABLE|DECOMMISSIONED` · `LOST`, `DECOMMISSIONED` terminal. Anything else → 400.
- `router_assignments.holder_type` = `WAREHOUSE | TECHNICIAN | CUSTOMER`. Every status change inserts a new row and sets `released_at` on the previous one **in the same transaction**; the current holder is the row where `released_at IS NULL`.
- Router creation inserts the initial `WAREHOUSE` assignment row. Serial uniqueness enforced by a DB unique constraint.
- Assign (`WAREHOUSE_STAFF`/`ADMIN`, `POST /routers/:id/assign`): router not `AVAILABLE` → 409.
- Manual status override requires a reason.
- IPs: `address` as `INET`, unique and indexed; status `AVAILABLE | ASSIGNED | RESERVED | RETIRED`. Bulk import of 1000+ rows returns `{ inserted, skipped, errors }`; duplicates are skipped and reported, never abort the batch. Every status mutation writes exactly one history row.
- Warehouse delete with technicians or routers attached → 409.
- Router report uses the M2a pipeline; a warehouse with zero routers does not error.

**Bad shape — reject if:**

- Router status updated without closing the previous assignment row.
- Any transition outside the list above.
- One bad CSV row rolls back or fails the whole import.
- `ip_addresses.customer_id` created as a real FK (stays a bare nullable UUID until M4a).
- Report logic duplicated instead of reusing the M2a pipeline.

---

### M3a — Ticket Core

_7 issues · SRS payment: M3 20% (shared across M3a–c)_

**Goal:** ticket CRUD, status machine, mandatory-photo rule, close-time triggers. `customers` is a **stub** only.

_Lanes (other backend developer, Wave 4):_ Starts after the router-transition card is frozen. The install-close issue waits for M2b to merge.

**Issues:** schema (`customers` stub: `id, name, phone, address, gps_lat, gps_lng, status (ACTIVE|INACTIVE|SUSPENDED), created_at`; `tickets`, `ticket_status_history`, `ticket_photos`) · ticket CRUD · transitions · photo on completion · cancellation · router/IP update on install close · CS satisfaction rating.

**Definition of done:**

- Types `INSTALLATION | TECHNICAL_ISSUE | COMPLAINT | MAINTENANCE`; priority `LOW | MEDIUM | HIGH | URGENT`; status `PENDING → ASSIGNED → IN_PROGRESS → COMPLETED | CANCELLED`. Skipping a step → 400.
- Installation ticket cannot reach `COMPLETED` with zero photos → 400; for maintenance/complaint the photo is optional. One shared validation path, not per-endpoint copies.
- Every status change writes a `ticket_status_history` row (actor, timestamp).
- On installation close: router → `INSTALLED_AT_CUSTOMER` (with its assignment-row handoff) and IP → `ASSIGNED`, **in the same transaction** as the ticket update.
- CS can cancel at any status with a reason; history retained and reportable.
- Rating 1–5, entered by CS after closure.

**Bad shape — reject if:**

- `customers` gets `national_id`, `subscription_plan` or other M4 fields.
- Router/IP updates run as separate non-transactional calls.
- Photo rule enforced in one entry point only.
- `tickets.customer_id` created as a real FK.
- Router transition on close bypasses the M2b whitelist or assignment-row logic.

---

### M3b — Morning Batch Assignment

_3 issues_

**Goal:** CS-reviewed daily assignment suggestions. This is an optimization problem, not CRUD.

_Wave 4. Paired session first (Marwan + other backend developer) for the algorithm; then the other developer implements CS review and manual assign. Requires the push-payload card frozen at the start of Wave 4._

**Issues:** suggestion algorithm · CS review/confirm endpoint · manual assign/reassign.

**Definition of done:**

- The exact load-balance metric is written into the spec **before** the algorithm (e.g. "minimize the maximum tickets per technician" vs "even count"). If `/specify` has no answer, stop and ask.
- Technicians with `status = ON_LEAVE` are excluded.
- Generating suggestions notifies nobody. Technicians are notified only after CS confirms.
- Manual assign/reassign works at any time and any ticket status; reassignment notifies both the original technician (if any) and the new one.
- The schedule comes from config (OI-05), commented as provisional.
- Tickets that cannot be placed stay `PENDING`.

**Bad shape — reject if:**

- An undefined, invented balancing heuristic.
- A notification fires at suggestion time.
- A guessed cron time hardcoded as settled.
- Reassignment notifies only the new technician.
- Suggestions auto-confirm after a timeout (SoW §6 excludes fully automated routing).

---

### M3c — Tracking + Notifications

_6 issues · requires M3a and M3b_

**Goal:** live GPS and push infrastructure.

_Lanes (other backend developer, Wave 5):_ Starts after M3a and M3b merge. The ping-schema card freezes in Wave 4.

**Issues:** schema (`technician_locations`, `ticket_routes`, `device_tokens`) · WebSocket ingestion · live map channel · route history · FCM token registration · push notifications.

**Definition of done:**

- Pings accepted only while the technician is checked in (§2a); each point carries the active ticket id when one is `IN_PROGRESS`.
- The WebSocket connection is authenticated, and the technician id comes from the connection identity, never the payload.
- Socket.io runs with the Redis adapter.
- `ticket_routes` has a retention window and a scheduled cleanup job (provisional, OI-12).
- Device token registration is an upsert per `(user_id, device)`; no duplicate pushes.
- Pushes: batch confirmed, urgent assignment, reassignment (original technician and new one).
- Live map payload: name, online/offline, last-update timestamp.

**Bad shape — reject if:**

- No retention bound on location data.
- `technician_id` trusted from the payload.
- No Redis adapter.
- Pings accepted outside a checked-in session.
- Push sent inline on the request thread for bulk batches.

---

### Deploy gate (before M4a)

Owner: Marwan (WS-P).

_Lanes (WS-P):_ Starting to stand up staging during Wave 3 so it is warm by this slot. It only gates work that needs a reachable API (WS-E/M4b acceptance, WS-F on-device flows); nothing else may block on it. The "latest allowed slip" below is unchanged.

Stand up Railway staging (API, Postgres, Redis, worker) with real R2, SendGrid and FCM credentials; run migrations there; re-run M1–M3 acceptance checks against it. This is a deliverable, not a footnote: SRS §8 defines acceptance as passing QA **on staging**. Latest allowed slip: before M5a starts (mobile testing needs a reachable API).

---

### M4a — Customer Data Reconciliation

_3 issues · a gate, not a feature phase_

**Goal:** make the deferred FKs on `ip_addresses.customer_id` and `tickets.customer_id` safe. The only output is trustworthy data.

_Lanes (WS-P + WS-C owner):_ The audit runs during Wave 4, parallel with M3b. Only the reviewed constraint migration is serial, and it must merge before any M4b issue that touches `ip_addresses` or `tickets.customer_id` — nothing else waits for it.

**Issues:** full `customers` schema (adds `national_id`, `subscription_plan` as a plain label) · audit existing placeholder `customer_id` values · add the FK constraints.

**Definition of done:**

- The audit produces a concrete report: how many rows reference a non-existent customer and what happened to each (nulled, backfilled or flagged). The report is reviewed **before** the constraint migration runs.
- The FK migration applies cleanly.

**Bad shape — reject if:**

- FKs added with no prior audit.
- This phase folded into M4b.
- Orphans silently nulled with no record.

---

### M4b — CRM + Reports + Dashboard

_13 issues · SRS payment: M4 20%_

**Goal:** customer features, reports, dashboard endpoints, API contract freeze.

_Lanes:_ Other backend developer owns reports and CRM. Marwan owns the OpenAPI freeze process and review of `report_jobs`.

**Issues:** customer CRUD · search · ticket history · average rating · auto-release IP on deactivation · report persistence (`report_jobs`) · technician performance report · ticket summary (Excel + PDF) · router/IP reports finalised · dashboard summary endpoints · OpenAPI freeze · system config endpoints · customer GPS capture.

**Definition of done:**

- Customer GPS is **required** for active customers (overrides SRS FR-CRM-01); capture via CS map picker (Leaflet), WhatsApp location-link parsing secondary.
- Deactivating a customer releases their IP to `AVAILABLE` in the same transaction.
- `report_jobs` persists job history and ownership on top of the M2a pipeline; the attendance and router reports migrate onto it. No report is a one-off synchronous endpoint.
- Technician performance metrics follow SoW §3 definitions (response time per §2a).
- Search covers name, phone, national ID and IP address.
- System config endpoints (ADMIN): shift hours, GPS radius, low-stock thresholds.
- Each module's OpenAPI snapshot is frozen before the frontend builds that module.

**Bad shape — reject if:**

- GPS optional "to match the SRS".
- IP release needs a separate manual step.
- A second report mechanism alongside the M2a pipeline.
- Contract still changing after the freeze without a versioned change.

---

### M5a — Mobile Screens + Core Flows

_8 issues_

**Goal:** screens and happy-path flows. Not offline sync.

_Lanes (WS-F, mobile dev):_ Expo scaffold + secure token storage + login/forgot-password can start earlier against the local API. If the mobile dev is not on board yet, the backend builds the scaffold and the first integration (same model as the web login screens, SoW §8: technology is the developer's call). Attendance screens consume the WS-A contract; My Tasks consumes WS-C; push handling + deep link consumes the WS-D `push-payload` card; on-device testing waits for the deploy gate.

**Issues:** Expo scaffold + secure token storage · login/forgot password · home · attendance screens · My Tasks (tabs + detail) · start/complete + install photo · push handling + deep link · profile.

**Definition of done:**

- Refresh token in `expo-secure-store` only.
- Every server-enforced rule (install photo, no-skip transitions, GPS on check-in) is mirrored in the UI for UX, and the server remains the authority.
- Task detail shows customer, router serial and IP read-only.
- API base URL comes from Expo config/env.

**Bad shape — reject if:**

- Tokens in `AsyncStorage`.
- A rule enforced only client-side.
- Hardcoded base URL.
- Edit affordances on read-only fields.

---

### M5b — Offline Sync + QA + Deployment

_6 issues · SRS payment: M5 15%_

**Goal:** offline check-in, verification, production go-live.

_Lanes (all hands):_ Serial by design — the E2E suite, load validation and the handover package require every stream's output. Do not try to parallelize this milestone; treat it as the final all-hands checkpoint.

**Issues:** offline check-in caching + sync · full E2E against staging · load/perf validation · production deployment + credential handover · admin training + docs · warranty tracking kickoff.

**Definition of done:**

- Offline-then-synced check-in is **idempotent** (idempotency key or equivalent); retrying sync cannot create a duplicate attendance row.
- E2E runs against staging and covers every milestone's criteria, as a repeatable suite with a recorded pass/fail.
- Load results are measured against NFR-01 (API p95 < 500 ms) and NFR-02 (report jobs < 60 s on 12 months) and recorded.
- The credential handover package exists and is verified before production is called done.

**Bad shape — reject if:**

- Sync can duplicate a check-in/check-out.
- "E2E" means one manual click-through.
- Production deploy happens before the handover package exists.

---

## 4. Cross-Milestone Schema Ownership

| Table                                                      | Created    | Extended                                                          | FK added            |
| ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------- | ------------------- |
| `users`                                                    | M1         | M2a (`department` → enum, `status` + `ON_LEAVE`, personal fields) | —                   |
| `warehouses`                                               | M1 (stub)  | M2b (full CRUD)                                                   | —                   |
| `attendance_records`                                       | M2a        | —                                                                 | —                   |
| `routers` / `router_assignments`                           | M2b        | —                                                                 | —                   |
| `ip_addresses` / `ip_history`                              | M2b        | —                                                                 | M4a (`customer_id`) |
| `customers`                                                | M3a (stub) | M4a (full)                                                        | —                   |
| `tickets` / `ticket_status_history` / `ticket_photos`      | M3a        | —                                                                 | M4a (`customer_id`) |
| `technician_locations` / `ticket_routes` / `device_tokens` | M3c        | —                                                                 | —                   |
| Report-job pipeline (BullMQ, no table)                     | M2a        | —                                                                 | —                   |
| `report_jobs` (persistence)                                | M4b        | —                                                                 | —                   |

A phase that touches a table before its "Created" phase, or adds an FK before its "FK added" phase, is building out of order. Stop and flag it. This rule is **unchanged** by the parallel work model (§6): parallelism reorders milestones around it, never through it.

---

## 5. Risks that need your decision (not the agent's)

1. **Inventory scope gap.** SoW §2.1.6 describes a generic item/product catalog with inbound, outbound, returns, low-stock alerts and per-item movement history. SRS FR-WH-02 narrowed this to routers only, and M2b builds router lifecycle only. The SoW governs, so this is potential under-delivery. Get written client sign-off that routers-only satisfies §2.1.6, or raise a change request. `/specify` must not resolve it silently.
2. **Milestones do not match the contract.** SoW §10 pays by five _phases_ (25% at signing; Phase 2 Core Backend; Phase 3 Operations Backend; Phase 4 Reports, Notifications & Mobile; Phase 5 QA/Deploy). These M1–M5 follow SRS §6 and your m1/m2 instead. The groupings differ (e.g. IP management is Phase 3 in the SoW but M2 here; mobile sits with reports in SoW Phase 4). Align the SoW §10 phase list with this milestone list before signing.
3. **Staging deferral vs acceptance.** Local-only dev is fine, but SRS §8 defines acceptance as QA on staging, so M1–M3 cannot be formally accepted until the deploy gate. Agree in writing to accept against a demo build, or move the gate earlier.
4. **OI-05, OI-10, OI-12** gate M3b/M3c behaviour; the placeholders above are provisional by design.
5. **Stale issue bodies.** m1 #2, #6, #13 and m2 (via m1 conventions) describe Prisma, bcrypt and Railway. An agent reading those issues will fight this plan. Rewrite them to Drizzle, argon2id and Docker before feeding them to anything.
6. **Parallel-contract drift (new, consequence of §6–§7).** With 3–4 streams in flight, the biggest failure mode is two streams implementing against a contract one of them silently changed; it surfaces as "everything worked until the checkpoint". The mitigations are structural: single-writer shared surfaces (§6.2 rule 2), frozen contract cards with CI snapshot diffs for OpenAPI (§7a), and the wave-boundary integration checklist (§7c). If a checkpoint fails on contract drift, the offending stream rebases before starting anything new — no exceptions.
7. **Timeline is not verified — fix before signing.** The SoW says 16–21 weeks (§11), and the SRS says 17–22 weeks. Nobody knows what full-time or hour assumptions those estimates made. Two things stand out. **Backend:** about 35–40 combined backend hours a week (feature work plus Marwan's review time) is roughly one full-time developer. If the estimate assumed one full-time backend developer, backend may roughly fit — but once review, integration, and bugs take their share, expect it to run longer. **Frontend:** 10–15 hours a week is about a third of a full-time person. The web dashboard covers more than ten modules, and the mobile app is a separate build. Best guess, to be verified with real hour estimates (not the agent's): the frontend alone runs several months longer than the backend. The SoW timeline does not account for this.

---

## 6. Parallel Work Model — streams and ownership (added 2026-10-22)

§3 stays the scope and acceptance authority; nothing in this section changes a milestone's DoD or "bad shape" tests. What changes is scheduling: "run in this order" assumed one developer. With a team, the plan is restructured around work-streams so nobody is blocked on another stream's small internal change. The design principle: **a stream is blocked only by a frozen contract, never by another stream's implementation.**

### 6a. Team and streams

Team: 2 backend devs + 1 web-frontend dev + 1 mobile dev (mobile joins at M5 scope but may base its scaffold on backend work earlier; the backend builds the first integration for web and mobile whenever the dedicated dev is not yet on board — same for both).

| Stream | Default owner | Owns (module + tables) | Consumes |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------ | ------------------------------- |
| **WS-P** Platform & contracts | Marwan (10–15h), plus integration | `@alfahd/types` enum tuples, migration-chain merge order, contract registry, CI, OpenAPI snapshots, deploy gate | — |
| **WS-A** People | Other backend developer (30–35h), sequential | HR/employee CRUD, `attendance_records`, check-in/out, **report-job pipeline** (M2a) | `users` schema (M1 + M2a extension) |
| **WS-B** Supply | Other backend developer (30–35h), sequential | `warehouses`, `routers`, `router_assignments`, `ip_addresses`, `ip_history` (M2b) | `report-pipeline` card (WS-A) |
| **WS-C** Tickets | Other backend developer (30–35h), sequential | `customers` (stub → M4a), `tickets`, `ticket_status_history`, `ticket_photos` (M3a + M3b) | `router-transition` card (WS-B), `push-payload` card (WS-D) |
| **WS-D** Realtime | Other backend developer (30–35h), sequential | Socket.io + Redis adapter, `technician_locations`, `ticket_routes`, `device_tokens`, FCM (M3c) | check-in fact (WS-A), active ticket (WS-C) |
| **WS-E** Web | Frontend developer (10–15h, web and React Native); Marwan integrates | `apps/web` dashboard modules | frozen OpenAPI per module |
| **WS-F** Mobile | Frontend developer (10–15h, web and React Native); Marwan integrates | Expo app (M5) | frozen OpenAPI, `push-payload` card |

Owners are assigned by hours, not stream size. Feature streams are sequential for the one backend developer who owns them.

**Not streams:** M4a is a WS-P gate with the WS-C owner on the audit; M4b splits by domain (see its `_Lanes_` line); M5b is all-hands serial.

### 6b. Parallelism rules — additions to the §1 constitution; violation = "not done"

1. **§4 table ownership is unchanged.** Parallelism never lets a stream create or extend a table outside its own milestone — only the owning stream's migration may touch it.
2. **Authoring vs merging.** Each stream writes schema and migrations for its own tables on its branch. Only WS-P merges to master and sets merge order. Feature streams never edit another stream's schema file or `app.module.ts`.
3. **Contract cards.** Anything a second stream depends on is a card in `docs/contracts/` with: exact Drizzle blob or TS signature, owning stream, consuming streams, status `proposed → frozen → superseded`. Cards are named and listed in §7a. A frozen card is an interface, not an implementation.
4. **Start rule.** A stream may start an issue when (a) every schema that issue's DoD needs is merged, (b) every consumed card is `frozen`, (c) the stream's own OpenAPI fragment is committed. Nothing else is a dependency — in particular, a producer's implementation remaining unfinished is not a blocker (see rule 5).
5. **Stub protocol.** When a card is frozen but the producer hasn't implemented it yet, WS-P merges the frozen signature as a stub that throws 503 with a `contract-pending` code and a `TODO(WS-x)` comment naming the owning stream. The consumer builds and tests against the stub; the producer replaces it later without touching the signature.
6. **No cross-stream edits.** Need to change another stream's file or a frozen card? Open a card change with the owner — never commit. Emergency fixes require the owner's explicit approval in the PR review.
7. **Contract change = card first, code second.** Breaking change → new card version + consumer sign-off recorded in the card. While frozen, CI diffs OpenAPI output against the snapshot and fails on a breaking change (§7c step 4).
8. **Tests travel with the stream.** Each stream ships vitest specs for its issues; a stream is never blocked waiting on another stream's suite. Cross-stream behavior is asserted at integration checkpoints (§7c), not in either stream's unit tests.
9. **Constitution and contract cards are read from master only.** Spec-kit artifacts (`.specify/`, plans, tasks) of a stream live on that stream's branch, not `master`'s. Two streams never share a working copy unsynchronized.
10. **One migration PR at a time.** Before merging: rebase on master, delete the generated migration and snapshot, regenerate with `--name`, and run the fresh-DB replay (§7c step 3). If `drizzle-kit check` exists on 0.45.2, run it in CI — I haven't verified that it does; confirm with `npx drizzle-kit --help`.

---

## 7. Parallel Schedule — cards, waves, integration

### 7a. Contract cards (the only serialization points)

| Card | Owner | Must be frozen before | Consumers |
| ----------------- | ----- | --------------------- | --------- |
| `auth-service` — shapes of `login()`, `refresh()`, `revoke()` | WS-P | Wave 0 M1 split | both M1 lanes |
| `report-pipeline` — BullMQ queue name, job payload, `GET /jobs/:id` response shape | WS-A | Wave 2 | WS-B router report; M4b `report_jobs`; WS-E report UI |
| `router-transition` — `RoutersService.transition()` signature incl. assignment-row handoff semantics | WS-B | Wave 2 | WS-C install-close issue |
| `ping-schema` — GPS ping payload + check-in gating fact | WS-A (active-ticket field co-designed with WS-C) | Wave 4 | WS-D ingestion, WS-F attendance screens |
| `push-payload` — notification types, FCM payload, deep-link shape | WS-D | Wave 4 (M3b) | M3b, WS-F push handling + deep link |
| `openapi/<module>` snapshot | module owner + WS-P | before WS-E or WS-F builds that module | WS-E, WS-F |

### 7b. Waves (each row is capacity-based, not a calendar date)

| Wave | Marwan (WS-P, review, integration) | Other backend developer (WS-A/B/C/D) | Frontend (WS-E/F) |
| ---- | ---------------------------------- | ------------------------------------ | ----------------- |
| **0** | Close remaining M1 issues; freeze auth-service | — | Web login scaffold |
| **1** | Create `docs/contracts/` and OpenAPI snapshot CI | M2a: report pipeline, then employee schema and CRUD | Web shell and design system |
| **2** | Freeze report-pipeline; review M2a | M2a: check-in/out, photo upload, R2, override, attendance export | Web: employee screens once `openapi/employees` is frozen |
| **3** | Freeze router-transition; review M2a/M2b | M2b: warehouses, routers, transitions, assignment, IP import and history | Web: HR screens; supply screens once `openapi/supply` is frozen |
| **4** | Paired M3b algorithm session; start deploy gate | M3a tickets; M3b confirm and manual assign | Web: supply screens; RN scaffold and login |
| **5** | M4a audit review; finish deploy gate | M3c: ping schema, ingestion, live map | Web: tickets; RN attendance |
| **6** | Integration checkpoint | M3c: FCM and notifications; M4b reports | Web: CRM and reports; RN tasks |
| **7** | M4b OpenAPI freezes; FK constraint merge | M4b: CRM and performance reports | Web and RN polish; integration |
| **8** | M5b all-hands | M5b | M5b |

Waves are capacity-based defaults, not dates — a wave moves when its owner finishes, not when a calendar slot opens.

### 7c. Integration checkpoints (wave boundaries + one mid-wave slot)

Run by WS-P (or the integrator on duty), always in this order, on the integration branch:

1. Merge cards/types → migration PRs → API feature branches, in dependency order (WS-A and WS-B first, then WS-C and WS-D).
2. `pnpm build types && pnpm typecheck && pnpm test` — all green.
3. Fresh-compose migration replay: `docker compose down -v && docker compose up -d && pnpm db:setup` — a chain that dies here is a checkpoint failure for the breaking stream, not mid-wave churn.
4. OpenAPI snapshot diff — a breaking change without a card version bump blocks the merge (§6b rule 7).
5. Incremental smoke test, growing per wave: login → check-in → router assign → install-ticket close → report job lands in R2. Wave 4 adds push delivery; Wave 5 adds customer deactivation IP-release.

Streams work on `ws/<stream>/<topic>` branches, rebased on `origin/master` per the AGENTS.md rules (`git switch` for switching, `git rebase` for updates, never `merge`). PRs are small; a migration PR carries zero feature code beyond its own stream's additions.

### 7d. What stays serial — even in the parallel model

- The deploy gate (staging) and M4a's constraint migration — the production chain of trust.
- The M3b algorithm design session — one pair of backend devs, not two separate halves.
- Consolidating the report pipeline (M2a), OpenAPI freeze (M4b), and M5b acceptance.
