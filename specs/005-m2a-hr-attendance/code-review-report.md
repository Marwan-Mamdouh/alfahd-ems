# Code Review Report — M2a Security Fixes & Complexity Reduction

**Branch:** `feat/m2a-hr-attendance` (changes left uncommitted for review)
**Source prompt:** `specs/005-m2a-hr-attendance/code-review-implementer-prompt.md`
**Date:** 2026-10-19
**Scope:** 10 security fixes (SEC-01…SEC-10), 7 simplifications (SIMP-01…SIMP-07)

## Verification results (all green)

| Gate | Command | Result |
|---|---|---|
| Types build | `pnpm --filter @alfahd/types build` | ✅ pass (run first — API resolves `@alfahd/types` from `dist/`) |
| Typecheck | `pnpm --filter @alfahd/api typecheck` | ✅ 0 errors |
| Lint | `pnpm --filter @alfahd/api lint` | ✅ 0 errors, 0 warnings (Prettier-formatted) |
| Unit tests | `pnpm --filter @alfahd/api test` | ✅ **22 suites / 161 tests** (baseline 18 suites + 4 brand-new suites) |
| E2E tests | `pnpm --filter @alfahd/api test:e2e` | ✅ **4 suites / 65 tests** (8 new e2e cases) |
| Migration | `pnpm --filter @alfahd/api db:generate` | ✅ `drizzle/0003_aberrant_doctor_spectrum.sql` (1 index) |

---

## Part 1 — Security fixes

### SEC-01 — Spreadsheet formula injection (CWE-1236) ✅
- **New** `apps/api/src/common/utils/spreadsheet.utils.ts`: `sanitizeSpreadsheetCell()` prefixes `'` when a value starts with `=`, `+`, `-`, `@`, `\t`, `\r`.
- `attendance.worker.ts`: applied to `name`, `email`, `department`, and `overrideReason` cells.
- **Tests:** new `spreadsheet.utils.spec.ts` (all 6 trigger chars, HYPERLINK payload, null/undefined) + worker e2e-style test asserting the generated `.xlsx` cells start with `'=` and never `=`.

### SEC-02 — HTML injection in welcome email ✅
- **New** `apps/api/src/common/utils/html.utils.ts`: `escapeHtml()` for `& < > " '`.
- `users.service.ts` `createEmployee`: `escapeHtml(dto.name)` interpolated into the `html` field (plain-text `text` field intentionally left raw — no HTML interpretation).
- **Tests:** new `users.service.spec.ts` asserts `<img src=x onerror=…>` arrives escaped in `html` and raw in `text`.

### SEC-03 — DoS via unbounded Multer buffering ✅
- `employees.controller.ts`: `FileInterceptor('file', { limits: { fileSize: 5 MB } })` — the cap is now enforced **while the payload streams**, before heap buffering. The service-level 5 MB check remains as defense in depth.
- `http-exception.filter.ts`: Nest translates Multer `LIMIT_FILE_SIZE` into `PayloadTooLargeException` (413); the filter now maps it to **400 with `error.code = 'FILE_TOO_LARGE'`**.
- **Tests:** new e2e case uploads a 5 MB + 1 byte file and asserts `400 FILE_TOO_LARGE`.

### SEC-04 — Information disclosure via `failedReason` ✅
- `jobs.service.ts`: raw `job.failedReason` is **never** returned; clients get the constant `GENERIC_JOB_ERROR = 'Report generation failed'`, while the full reason is logged server-side via `Logger.error`.
- **Judgment call:** masking applies to *all* callers (including admins) — internal DB/Cloudinary details are operator-only data, not an admin UI concern. The prompt allowed (non-admin OR non-production) masking; this is the stricter reading.
- **Tests:** updated `jobs.service.spec.ts` (leak test asserting `ECONNREFUSED`/table names never appear in the response JSON) + new e2e case polling a failed job fixture.

### SEC-05 — Predictable BullMQ job IDs ✅
- `attendance.service.ts` `enqueueReport`: third argument `{ jobId: randomUUID() }` (`node:crypto`), matching `spec.md` line 72 (`{ "jobId": "<uuid>" }`).
- **Tests:** unit test asserting v4-UUID format **and** uniqueness across enqueues; existing `toHaveBeenCalledWith` updated for the new third argument.

### SEC-06 — Missing UUID validation → 500s ✅
- `employees.controller.ts`: `@Param('id', ParseUUIDPipe)` on `GET /:id`, `PATCH /:id`, `PATCH /:id/status`, `POST /:id/photo`.
- `attendance.controller.ts`: `@Param('id', ParseUUIDPipe)` on `PATCH /:id`.
- **Tests:** new e2e cases (`GET /employees/not-a-uuid`, `PATCH /attendance/not-a-uuid` → 400). The m2a e2e fixture id `att-123` was migrated to a real UUID (`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`) — behavioral assertions unchanged.
- *Out of scope (follow-up):* `users.controller.ts` `:id` routes and `jobs.controller.ts` `:id` were left as-is per the prompt's file list.

### SEC-07 — Insufficient DTO validation ✅
- `create-employee.dto.ts`: `hireDate` `@IsString()` → `@IsDateString()`; `phone`/`nationalId` gain `@MaxLength(30)` (matching `varchar(30)`).
- `update-employee.dto.ts`: `phone` gains `@MaxLength(30)` — **small scope extension** (same column, same 500 otherwise; consistent with the issue's intent).
- Chronology: validated in `AttendanceService.override` on the **effective** record (`dto` value falling back to the stored value), so both "both fields in payload" and "one field vs stored counterpart" inversions are rejected with `400 CHECK_OUT_BEFORE_CHECK_IN`.
- **Tests:** e2e cases for `hireDate: 'not-a-date'` → 400 and 31-char phone → 400; unit cases for payload-vs-payload and payload-vs-record inversions (asserting the UPDATE is never issued), plus `hoursWorked` computed by override.

### SEC-08 — Check-in race returning 500 instead of 409 ✅
- `attendance.service.ts` `checkIn`: insert wrapped in `try/catch`; Postgres `23505` (or constraint `attendance_records_user_id_work_date_unique`) → `409 { code: 'ALREADY_CHECKED_IN' }`; any other error is rethrown unchanged.
- **Tests:** unit cases for the 23505 → 409 mapping and for non-constraint errors still propagating.

### SEC-09 — Haversine `NaN` on `a > 1` ✅
- `geo.utils.ts`: `a` clamped to `[0, 1]` before `sqrt`.
- **Tests:** regression test using a pair that *reproduces the old bug* — `(45, 0) → (-45, 180)` yields `a = 1.0000000000000002` and `NaN` with the old code; now asserts finite ≈ half-circumference distance for two such pairs.

### SEC-10 — Silent production fallback to fake storage ✅
- `env.validation.ts`: `superRefine` now requires all three `CLOUDINARY_*` vars when `NODE_ENV === 'production'` (boot fails with per-key messages).
- `storage.module.ts`: production without credentials **throws** at DI resolution; `test` still uses `FakeStorageService`; development keeps the visible fake fallback only when Cloudinary is unconfigured.
- **Tests:** 3 new `env.validation.spec.ts` cases (missing-in-prod rejected per key, dev allows missing, full prod env parses).

---

## Part 2 — Complexity reduction

### SIMP-01 — Department filtering moved into SQL ✅
- `attendance.worker.ts`: `if (department) conditions.push(eq(users.department, department))`; the in-memory `.filter(...)` and `filteredRows` are gone — the DB never ships irrelevant rows over the network.
- **Test:** worker spec rewritten to assert the condition reaches `.where()` and the returned (SQL-filtered) rows are used directly.

### SIMP-02 — O(1) token lookup instead of keyspace SCAN ✅
- `session.service.ts` rewritten to the prompt's key layout:
  - `rt:token:{tokenId}` → `userId` (value), 7-day TTL → `findSessionByTokenId` = single `GET`.
  - `rt:user_tokens:{userId}` → Set of token ids (TTL refreshed on each login) → `revokeAllSessions` = `SMEMBERS` + pipelined `DEL`/`SET rv:*`, **O(K)** in that user's sessions, no `SCAN`.
  - `revokeSession` = pipelined `DEL` token key + `SREM` from the set + denylist `SET`.
- **Tests:** `session.service.spec.ts` rewritten — same behavioral coverage (TTLs, revoke counts, denylist, password-reset atomicity) plus explicit regression guards `expect(redis.scan).not.toHaveBeenCalled()`.
- **Deployment note:** sessions created under the old `rt:{userId}:{tokenId}` layout are unreadable by the new lookup → **all users must re-login once** after deploy (refresh tokens are the only casualty; access JWTs run out naturally).

### SIMP-03 — Cutoff comparison simplified ✅
- `clock.service.ts`: `isAfterCutoff` now formats `"HH:MM:SS"` with a **per-timezone cached** `Intl.DateTimeFormat` (`hourCycle: 'h23'`) and does one lexicographic comparison against `cutoff:00` — from ~18 lines of `formatToParts`/`find`/chained comparisons to 2 lines. Semantics identical (strictly-after, zero-padded 24h ordering).
- **Tests:** existing winter/summer DST cutoff tests pass unchanged.

### SIMP-04 — `isActive` vs `status` reconciled ✅
- `users.service.ts` `updateEmployeeStatus`: `isActive = status !== 'INACTIVE'` (was `status === 'ACTIVE'`). An `ON_LEAVE` employee keeps login + sessions per `spec.md` Acceptance Scenario 5; `INACTIVE` still deactivates and revokes (unchanged `employees.service.ts` behavior).
- Eligibility gating remains on `status`: `AttendanceService.checkIn` already rejects `status !== 'ACTIVE'`, which is the only assignment-style activity gate in this API.
- **Note:** no ticketing module exists in `apps/api` yet (M3+), so there was no ticket-assignment check to retarget; when it lands it must test `user.status === 'ACTIVE'`, not `isActive`.
- **Tests:** new `users.service.spec.ts` parametrized over `ACTIVE/ON_LEAVE/INACTIVE → isActive true/true/false` + an ON_LEAVE sessions-stay-valid case; new e2e case verifying an `ON_LEAVE` status change leaves `rt:token:*` sessions intact.

### SIMP-05 — Pagination clamping deduplicated ✅
- `employee-query.dto.ts`: `page`/`pageSize` are now **required with defaults** (`= 1`, `= 20`), bounds enforced once by `@Min(1)`/`@Max(100)` through the global `ValidationPipe`.
- Removed `Math.max`/`Math.min` clamping from `employees.service.ts` **and** `users.service.ts` (the `?? 1`/`?? 20` remain only to satisfy the optional `page?:` typing of the shared `EmployeeQueryDto`).
- **Behavior change (intended):** `?pageSize=500` now returns **400** instead of silently clamping to 100.

### SIMP-06 — `hoursWorked` unified ✅
- **New** `apps/api/src/common/utils/attendance.utils.ts`: `calculateHoursWorked(checkIn, checkOut?)` → 2-decimal number or `null` (missing check-out, unparseable date, or inverted interval).
- Used by `AttendanceService.checkOut`, `AttendanceService.override` (which previously **omitted** `hoursWorked` entirely — now returns it, allowed by `AttendanceRecordDto.hoursWorked?: number | null`), and `AttendanceReportWorker` (`toFixed(2)` only for display).
- **Tests:** new `attendance.utils.spec.ts` + override-returns-`8.5` unit case + worker cell assertion (`'8.50'`).

### SIMP-07 — Index on `attendance_records.work_date` ✅
- `database/schema/index.ts`: `index('attendance_records_work_date_idx').on(t.workDate)` alongside the existing composite unique.
- Generated `drizzle/0003_aberrant_doctor_spectrum.sql` (+ snapshot/journal) via `pnpm --filter @alfahd/api db:generate`.
- **Deployment note:** run `pnpm --filter @alfahd/api db:migrate` against real environments.

---

## Test-suite changes (per reviewer decision: "update tests to the new contract")

Tests that *encoded the vulnerable/complex behavior* were updated; every assertion's **intent** was preserved or strengthened:

| File | Why it had to change |
|---|---|
| `src/redis/session.service.spec.ts` | Asserted the SCAN key layout SIMP-02 removes → rewritten for the O(1) layout + `scan` never called |
| `src/jobs/jobs.service.spec.ts` | Asserted raw `failedReason` passthrough SEC-04 removes → asserts masked generic + no-leak |
| `src/attendance/attendance.service.spec.ts` | `queue.add` arity changed (SEC-05) → third arg asserted; +5 new cases (UUID ids, 23505→409, rethrow, 2 chronology, override hours) |
| `src/attendance/attendance.worker.spec.ts` | Old "filters by department" relied on in-memory `.filter` → now asserts the condition reaches SQL |
| `test/m2a-hr-attendance.e2e-spec.ts` | `att-123` fixture → UUID (SEC-06); session seed → new key layout (SIMP-02); Redis stub grew `get/smembers/sadd/srem` + `DEL` on sets; +8 new e2e cases |
| `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts` | Redis doubles updated for the new session commands (no behavior assertions changed) |
| `test/config/env.validation.spec.ts` | Additive only (+4 SEC-10 cases) |

**New suites:** `spreadsheet.utils.spec.ts`, `html.utils.spec.ts`, `attendance.utils.spec.ts`, `users.service.spec.ts`.

## Observations & follow-ups (out of this prompt's scope)

1. **Pre-existing e2e noise (not from these changes):** `test/app.e2e-spec.ts` closes the app twice (test at line 64 + `afterEach` at line 69), producing a logged `Called end on pool more than once` error. All suites still pass; worth a one-line cleanup later.
2. `users.controller.ts` `PATCH/GET /users/:id` still lack `ParseUUIDPipe` (SEC-06 scoped to employees/attendance only).
3. `GET /jobs/:id` intentionally has no `ParseUUIDPipe`: legacy/stub job ids aren't UUIDs.
4. `revokeAllSessions` returns the count of *indexed* tokens; a token that expired naturally without logout could be counted until the set is next written. Harmless (idempotent `DEL`s) but worth knowing.
5. SEC-10 makes production boot **fail** without `CLOUDINARY_*` — ensure the deployment env is populated before this merges to `master`.

## Change inventory

- **Modified:** 27 tracked files (22 src/test + `drizzle/meta/_journal.json`) — `+818 / −179` lines
- **New (untracked):** 10 files — 4 utility modules with their specs (`spreadsheet.utils`, `html.utils`, `attendance.utils`, `users.service.spec`), migration `drizzle/0003_aberrant_doctor_spectrum.sql` + `drizzle/meta/0003_snapshot.json`, and this report
- **Nothing committed** — all work sits in the working tree for your review (the implementer prompt file was already staged separately).
- **Nothing committed** — all work is staged/unstaged in the working tree for your review.
