# Follow-up Plan — M2a second review verification

**Branch reviewed:** `feat/m2a-hr-attendance` (all 13 commits, vs `master`)
**Date:** 2026-10-23
**Verification:** local gates re-run on final tree — types build ✅, typecheck ✅, lint ✅, unit 21 suites / 185 tests ✅, e2e 4 suites / 70 tests ✅
**Spec conformance:** FR-001…FR-015, US1–US3 acceptance scenarios, and the three clarifications (366-day cap, old-photo deletion ordering, no earliest-check-in restriction) all verified implemented.

## Rebase verdict

**✅ OK to rebase with `master`.** No critical findings; all five Medium items below are narrow-scoped and none produce a auth bypass, data loss, or request-breaking regression. Recommended: land FIX-01…FIX-05 as an immediate follow-up commit on this branch (or right after rebase, before deploy — the deploy step is already deferred). Two deploy reminders unchanged from the hardening report: run `db:migrate` for `0003`, and production env must include all three `CLOUDINARY_*` vars (boot fails otherwise by design, SEC-10).

## FIX-01 (Medium, security) — Non-atomic `revokeAllSessions` race

`apps/api/src/redis/session.service.ts:72-86` — replays ZRANGE → pipeline (DEL tokens + `rv:*` + DEL index). A `createSession` interleaving between the ZRANGE and pipeline gets its index entry wiped by the trailing `del(userTokens)` while `rt:token:{id}` stays live for 7 days and is invisible to every future revocation. Attack window is milliseconds (password-reset / admin-deactivation racing a login), and the DB `isActive` re-check in the refresh flow mitigates the deactivation case — hence Medium, not High.

**Fix:** single Lua script performing member read, per-token `DEL`/`SET rv:*`, and index `DEL` atomically; allow `createSession` tokens added after the atomic revoke to remain indexed (still revocable going forward). Regression unit test: fire `createSession` between the injected `zrange` response and pipeline execution, assert the index retains the new token.

## FIX-02 (Medium, audit/spec) — Mandatory status-change `reason` is validated then discarded

`apps/api/src/employees/employees.service.ts:59-72` validates non-empty `reason`, then drops it. Spec acceptance scenarios 4–5 and `contracts/api-contracts.md §1.5` treat the reason as audit justification — no trace of it exists anywhere (unlike attendance overrides, FR-013).

**Fix:** thread `reason` into `updateEmployeeStatus` and persist (nullable `status_change_reason` column, migration 0004) or minimally structured-log it; add e2e unit of record carrying the payload.

## FIX-03 (Medium, ops/PII) — Report jobs & generated workbooks retained forever

`apps/api/src/jobs/jobs.module.ts` registers the `reports` queue with no `defaultJobOptions` — completed/failed jobs (holding `requestedBy`, query params, download URL) stay in Redis indefinitely. Each `.xlsx` (names, emails, attendance, override notes) is uploaded to public `reports/` in Cloudinary and never purged.

**Fix:** `defaultJobOptions: { removeOnComplete: { age: 7*24*3600 }, removeOnFail: { age: 7*24*3600 } }` on the queue; add a documented Cloudinary lifecycle (date-based purge scheduled in M-later, or move reports to a private prefix with signed URLs).

## FIX-04 (Medium, spec FR-004) — `PATCH /users/:id` role change bypasses the technician-warehouse invariant

`apps/api/src/users/users.service.ts:279-319` (`update`) writes `dto.role` without the invariant; `UpdateUserRequestDto` exposes `role?: Role` (`dto.ts:61-65`). An admin can set a warehouse-less user to `TECHNICIAN` — the exact state FR-004 forbids when "creating **or editing**" an employee.

**Fix:** apply the same invariant to `update` (reject `dto.role === ROLE.TECHNICIAN && !assignedWarehouseId`); feed it through the new shared helper from SIMP-01 extension.

## FIX-05 (Medium→Low DX, 500-class) — `@IsDateString()` accepts calendar-invalid dates → 500s

`isISO8601` (non-strict) accepts `2026-02-30`. Two unguarded paths: `POST /employees` `hireDate: "2026-02-30"` → Postgres date input rejection 500; `PATCH /attendance/:id` `checkInAt`/`checkOutAt` = same → `new Date(...)` Invalid Date reaches drizzle/pg 500 (compare `enqueueReport`, which has an `isNaN` guard). This partially falsifies the hardening report's SEC-07 claim: "not-a-date" is now 400, "not-a-real-date" is still 500.

**Fix:** `common/utils/date.utils.ts` → `parseIsoDateStringOrThrow(value)` that round-trips the date; use in `override` and for `hireDate` in create/update. 200→400, no other behavior change.

## Low-priority fixes (P2, one small commit)

- **FIX-06** `override` does not recompute `work_date` when `checkInAt` moves across midnight — recompute via `getLocalWorkDate(effectiveCheckIn, APP_TIMEZONE)` and include in the set() (`attendance.service.ts:272-284`).
- **FIX-07** Admin self-lockout via `PATCH /employees/:id/status` bypasses the self-deactivation guard that `UsersService.update` has — thread `requestingUserId` into `updateStatus` and reuse the guard.
- **FIX-08** Temp password entropy 48 bits (`Temp-${randomBytes(6).toString('hex')}!Aa1`) → `randomBytes(12)` (`users.service.ts:98`).
- **FIX-09** `APP_TIMEZONE` is not validated as IANA at boot, and `attendance.worker.ts:104-105` hardcodes `Africa/Cairo` for report timestamp rendering while check-in logic uses the env value. Validate (Zod superRefine + `new Intl.DateTimeFormat(tz)` probe) and thread the configured tz into `formatLocalTimestamp`.
- **FIX-10** Compensation delete in `uploadPhoto` (`employees.service.ts:104-108`) can throw and mask the original DB error — wrap in try/catch, `logger.warn`, rethrow `dbError`.
- **FIX-11** Concurrent photo uploads orphan the intermediate asset (stale `oldPhotoKey` read once) — re-fetch `profilePhotoKey` right before deleting the superseded asset.
- **FIX-12** Worker unknown-job-type guard returns a fake `COMPLETED` with `downloadUrl: ''` (`attendance.worker.ts:33-35`) → throw so the job lands `FAILED`, or return `downloadUrl: null`.
- **FIX-13** (docs) `code-review-report.md` SIMP-02 says "plain Set + SMEMBERS"; code uses a Sorted Set with expiry-score pruning (better). Update the doc; also the stale `"jobId": "report-attendance-…"` sample in `contracts/api-contracts.md` vs the v4 UUID actually returned (spec.md L72 and code agree).

## Simplification candidates (fold into P1/P2 commits)

1. **`assertTechnicianInvariant` helper** in `users.service.ts` — kills the FR-004 triple-implementation and makes FIX-04 free (three warehouse-existence queries today: `create`, `updateEmployee`, `update`).
2. **`parseIsoDateStringOrThrow` util** — the FIX-05 fix is written once instead of three per-endpoint guards.

## Known-spec-conformant behaviors left as-is (documented, not bugs)

- Cross-midnight check-out (check-in 23:50 → check-out 00:10) returns 400 `NO_ACTIVE_CHECK_IN` and leaves the prior record open until an admin override. FR-012 says "open check-in exists **for today**" — conformant, but a spec note for the next clarify session is worthwhile if technicians night-shift.
- `ValidationPipe({ whitelist: true })` silently strips unknown fields (client gets 200 ignoring a misspelled field); `forbidNonWhitelisted` is a deliberate future choice.
- `GET /jobs/:id` intentionally has no `ParseUUIDPipe` (legacy/stub ids).
