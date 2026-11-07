# PR #50 merge review and follow-up tickets

## Scope and verdict

**Verdict: request changes; not ready to merge.**

- PR: https://github.com/Marwan-Mamdouh/alfahd-ems/pull/50
- Reviewed HEAD: `61ea9c52c4f13cd06f5fb90d3e4c4afa3185fd2d`.
- Base ref: `origin/master`, resolved to `dd90359a8d95cfdb755f5c021a3d2f131bf11377`.
- Comparison: `git diff origin/master...HEAD` (five commits, 49 changed files).
- Governing spec: `docs/contracts/m2b-supply-implementation.md`, with router/report contracts and supply decisions.
- API/types working files match HEAD. Existing uncommitted planning/skill changes are not part of the reviewed implementation.
- All 12 tickets are published as GitHub issues #51–#62, each referencing PR #50. P1 means high-priority correctness or required delivery blocker; P2 means normal-priority required correction.

## Standards

1. **P1: Transaction boundary violates the documented invariant.** `apps/api/src/modules/routers/routers.service.ts:100–113,201–215,287–300` calls inventory writes without the router transaction. The helper at `apps/api/src/modules/repository/repositories/inventory.repository.ts:123–147` opens and commits another transaction. Contract lines 168–170 and 264 require atomic writes and caller-owned transaction support. See T01.
2. **P2: IPv4 host representation lacks its required database constraint.** `apps/api/drizzle/0005_m2b_supply_routers_ip.sql:6–16` defines INET and uniqueness but no IPv4/host-mask check. Contract lines 191–192 explicitly require database enforcement. See T05.

These are documented-standard violations, not heuristic smells. Tooling findings are reported separately under verification.

## Spec

1. **P1: Non-atomic serialized stock writes.** Contract lines 168–170: changes must “commit or roll back together,” “not via a separate independently committed transaction.” Concurrent receipts can overwrite quantity N with N+1 twice; rolling back an outer router operation cannot roll back the separately committed stock movement. See T01.
2. **P1: Existing-stock registration has no capacity guard.** `routers.service.ts:71–98` creates serviceable serials without checking opening-stock capacity when `isNewReceipt` is false. Contract line 164 requires preventing over-registration. See T02.
3. **P1: Condition/location changes corrupt accounting and custody.** `routers.service.ts:332–425` handles stock removal only for DAMAGED and does not handle a usable A-to-B warehouse move. Contract lines 140 and 153 require each contribution delta exactly once and “-1 source, +1 destination.” See T03.
4. **P1: CSV import bypasses the required job pipeline.** `apps/api/src/modules/ip-management/ip.controller.ts:165–171` processes CSV through the service on the request thread. Contract lines 224–225 require BullMQ and a `{ jobId }` response. See T04.
5. **P1: Quantity-only APIs bypass serialized accounting.** The new router integration accepts a product at `routers.service.ts:73–76` without protecting it from existing quantity-only writes such as `inventory.service.ts:174–190`. Contract line 171: “Prevent quantity-only … adjustment paths from silently changing serialized stock.” See T06.
6. **P1: Warehouse deactivation races with placement.** `warehouses.service.ts:85–92` checks and deactivates separately. Contract line 182: “Checking once before a separate update is insufficient.” See T07.
7. **P1: Returns accept inactive warehouses.** `routers.service.ts:261–278` uses the requested target without active-state validation. Contract line 183: “New placements into inactive warehouses must be rejected.” See T07.
8. **P1: Installation leaves technician custody open.** `routers.service.ts:250–315` has no customer handoff branch before persisting INSTALLED_AT_CUSTOMER. Contract lines 123–125 require closing the old assignment and creating the next for a normal handoff. See T08.
9. **P2: Manual transition reason is optional and discarded.** `dto/transition-router.dto.ts:18–23` makes it optional; `routers.service.ts:304–310` does not persist it. Contract line 101: “Manual status override requires a reason.” See T09.
10. **P1: IP concurrency violates reservation/history invariants.** `ip.service.ts:108–133,175–204` reads state without a lock and performs unconditional updates. Contract lines 196 and 202 require FREE-only archival and exactly one history event per actual status change. See T10.
11. **P2: Metadata audit is non-atomic and omits changed fields.** `ip.service.ts:92–101` commits metadata separately from a history record containing only “Updated notes.” Contract lines 204 and 291 require changed fields and atomic history. See T11.
12. **P2: IPv4 host constraint is missing.** The migration accepts general INET values; contract line 192 requires database constraints. See T05 (also reported independently under Standards).
13. **P2: Router report omits custody and warehouse totals.** `attendance.worker.ts:166–205` exports asset rows without custody or aggregates. Contract line 244 requires “warehouse totals” and physical location “separately from current custody.” See T12.

## Published tickets

| Review ticket | GitHub issue |
| --- | --- |
| T01 | [#51](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/51) |
| T02 | [#52](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/52) |
| T03 | [#53](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/53) |
| T04 | [#54](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/54) |
| T05 | [#55](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/55) |
| T06 | [#56](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/56) |
| T07 | [#57](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/57) |
| T08 | [#58](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/58) |
| T09 | [#59](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/59) |
| T10 | [#60](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/60) |
| T11 | [#61](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/61) |
| T12 | [#62](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/62) |

Native blocking dependencies: #52, #53, #57 and #58 are blocked by #51; #56 is blocked by #51 and #52. Business-policy prerequisites remain recorded in the ticket bodies.

### T01 — Make router, inventory, movement and custody writes atomic

- **Priority:** P1. **Axes:** Standards and Spec.
- **Evidence:** `apps/api/src/modules/routers/routers.service.ts:100–113,201–215,287–300,365–417`; inventory helper at `apps/api/src/modules/repository/repositories/inventory.repository.ts:123–147`.
- **Failure scenario:** Two receipts read the same stock quantity and overwrite each other. Alternatively, an outer caller-owned transaction rolls back after a transition, leaving committed stock/movement changes behind.
- **Required change:** Thread the caller-owned transaction through router and inventory operations; serialize conflicting operations and use atomic deltas rather than unprotected absolute quantities. Apply a consistent lock order and validate state inside the protected operation.
- **Acceptance criteria:**
  - Injected failure rolls back asset, stock, movement, custody and audit together.
  - Concurrent receipts preserve both increments; competing assignments cannot both succeed.
  - An outer transaction can roll back each supported centralized router operation.
  - Real PostgreSQL concurrency tests cover existing and initially missing stock rows.

### T02 — Enforce audited existing-stock onboarding capacity

- **Priority:** P1. **Axis:** Spec. **Depends on:** T01 and approved reconciliation policy.
- **Evidence:** `apps/api/src/modules/routers/routers.service.ts:69–98`; contract lines 157–175.
- **Failure scenario:** Register several distinct serviceable serials with `isNewReceipt: false` against zero opening stock. The assets are created and can be assigned despite no reconciled capacity.
- **Required change:** Freeze and implement serialized-SKU classification, registration capacity and explicit audited reconciliation. Registration must consume existing eligible capacity without creating a receipt.
- **Acceptance criteria:**
  - Registration never increases opening stock or exceeds eligible capacity.
  - Concurrent registrations and retries cannot over-register or fabricate movement history.
  - New receipts add exactly one eligible unit; damaged opening units have explicit reconciliation evidence.

### T03 — Calculate condition/location effects from before-and-after state

- **Priority:** P1. **Axis:** Spec. **Depends on:** T01.
- **Evidence:** `apps/api/src/modules/routers/routers.service.ts:332–425`; contract lines 105–128,132–155.
- **Failure scenarios:** Move an AVAILABLE/SERVICEABLE router from warehouse A to B: neither stock nor warehouse custody follows. Change SERVICEABLE directly to UNDER_REPAIR: stock/custody removal is skipped because the removal branch accepts only DAMAGED.
- **Required change:** Derive per-warehouse usable contributions from the complete old/new state, then apply deltas and custody changes atomically. Represent external placement and warehouse clearing explicitly rather than preserving the warehouse through null-coalescing.
- **Acceptance criteria:**
  - A-to-B move decrements A, increments B and moves custody once.
  - Both damaged and repair states remove usable contribution and applicable custody.
  - External repair clears physical warehouse placement while retaining auditable prior location.
  - Restoring serviceability adds stock only when lifecycle and physical placement permit it.

### T04 — Implement bounded, retry-safe asynchronous IP CSV import

- **Priority:** P1. **Axis:** Spec.
- **Evidence:** `apps/api/src/modules/ip-management/ip.controller.ts:147–171`; contract lines 220–236.
- **Required change:** Enqueue accepted input through BullMQ; return `{ jobId }`; add explicit import dispatch and requester/admin-scoped polling. Freeze limits, header/default policy, row outcomes and stable same-job retry bookkeeping.
- **Acceptance criteria:**
  - Request does not perform the import; at least 1,000 rows process asynchronously within explicit limits.
  - In-file, existing and concurrent duplicates become skips without aborting valid rows.
  - Invalid rows have safe row-numbered errors; retries preserve completed outcomes and history.
  - Polling returns `{ inserted, skipped, errors }` to authorized users only.
  - Attendance report workers cannot silently consume import jobs as successful reports.

### T05 — Enforce IPv4 host-only INET values in PostgreSQL

- **Priority:** P2. **Axes:** Standards and Spec.
- **Evidence:** `apps/api/drizzle/0005_m2b_supply_routers_ip.sql:6–16`; contract lines 191–192.
- **Required change:** Add a schema check equivalent to `family(address) = 4 AND masklen(address) = 32` and regenerate the branch's unmerged migration artifacts consistently.
- **Acceptance criteria:**
  - Direct SQL IPv6 and non-host network inserts fail; valid IPv4 hosts succeed.
  - Canonically equivalent addresses remain unique.
  - Migration replay succeeds on disposable empty and representative existing-data databases.

### T06 — Protect serialized SKUs from quantity-only inventory writes

- **Priority:** P1. **Axis:** Spec. **Depends on:** T01, T02.
- **Evidence:** New integration at `apps/api/src/modules/routers/routers.service.ts:73–76`; bypass example at `apps/api/src/modules/inventory/inventory.service.ts:174–190`; contract line 171.
- **Failure scenario:** Receive a router, then adjust the corresponding stock to zero through the generic API. The serialized router remains available and assignable.
- **Acceptance criteria:** Classification is authoritative; quantity-only inbound/outbound/return/transfer/adjustment operations reject serialized stock changes without corresponding serial operations; ordinary non-router inventory remains compatible.

### T07 — Serialize warehouse deactivation against all placement paths

- **Priority:** P1. **Axis:** Spec. **Depends on:** T01.
- **Evidence:** `apps/api/src/modules/warehouses/warehouses.service.ts:85–92`, `apps/api/src/modules/routers/routers.service.ts:54–69,261–278,421–428`; contract lines 179–185.
- **Failure scenarios:** Deactivation passes checks, a receipt inserts a router, then deactivation completes. Separately, RETURNED can target an already inactive warehouse.
- **Required change:** Share a transaction/warehouse-lock protocol across deactivation, receipt, return, condition/location placement and applicable inventory writes; validate target activity under that lock.
- **Acceptance criteria:** Concurrent placement/deactivation cannot leave new routers in inactive warehouses; inactive targets are rejected by every placement path; stock, staff, attached technicians and physically present damaged/repair devices continue to block deactivation with 409; historical references remain intact.

### T08 — Implement or gate customer installation custody handoff

- **Priority:** P1. **Axis:** Spec. **Depends on:** T01 and reviewed customer-target semantics.
- **Evidence:** `apps/api/src/modules/routers/routers.service.ts:250–315`; contract lines 123–127.
- **Failure scenario:** ASSIGNED_TO_TECHNICIAN transitions to INSTALLED_AT_CUSTOMER while the technician remains the open custody holder.
- **Acceptance criteria:** An allowed installation closes technician custody and creates the approved customer custody atomically, without premature customer tables/FKs. If the necessary target contract is unavailable, reject the operation rather than persist contradictory state. Historical assignments remain intact.

### T09 — Require and audit manual lifecycle transition reasons

- **Priority:** P2. **Axis:** Spec.
- **Evidence:** `apps/api/src/modules/routers/dto/transition-router.dto.ts:18–23`, `apps/api/src/modules/routers/routers.service.ts:304–310`; contract line 101.
- **Acceptance criteria:** Manual transitions reject missing/blank reasons; successful transitions persist actor, timestamp, old/new lifecycle and reason atomically; forbidden transitions remain 400 even with a reason; shared types and Swagger match runtime validation.

### T10 — Serialize IP reservation, release and archival mutations

- **Priority:** P1. **Axis:** Spec.
- **Evidence:** `apps/api/src/modules/ip-management/ip.service.ts:108–133,175–204`, `apps/api/src/modules/repository/repositories/ip.repository.ts:53–83`; contract lines 196–203.
- **Failure scenarios:** Two reservations read FREE and both append FREE-to-RESERVED history. Concurrent archive/reserve can leave an archived RESERVED address.
- **Required change:** Lock the row during validation/mutation/history, or use conditional updates with checked outcomes and correct retries.
- **Acceptance criteria:** Real PostgreSQL races prove one successful actual transition/history event, no archived RESERVED outcome, and no duplicate successful history from retries or competing calls. Release/unarchive use the same consistency policy.

### T11 — Persist reconstructable IP metadata audit atomically

- **Priority:** P2. **Axis:** Spec.
- **Evidence:** `apps/api/src/modules/ip-management/ip.service.ts:92–101`; contract lines 204,291.
- **Failure scenario:** A history insertion fails after the notes update committed. Even a successful audit omits old/new notes.
- **Acceptance criteria:** Metadata update and audit share one transaction; injected audit failure rolls back metadata; history captures changed fields, actor and time; unchanged metadata does not fabricate a successful change event.

### T12 — Complete router report custody and warehouse summary output

- **Priority:** P2. **Axis:** Spec.
- **Evidence:** `apps/api/src/attendance/attendance.worker.ts:166–205`; contract lines 240–253.
- **Acceptance criteria:** Export contains current custody independently of physical location and per-warehouse distinct-device summaries for usable stock, condition and lifecycle. Approved bucket labels make overlap explicit and avoid double counting. Empty warehouses produce readable output; existing attendance dispatch remains compatible. Verify actual Excel bytes download through configured storage with requester/admin-scoped job access.

## Merge acceptance evidence

After the tickets are resolved, record disposable-database migration replay, rollback/concurrency scenarios, real Redis mixed-job dispatch, 1,000+ row import/retry outcomes and actual storage download verification. Passing mocked HTTP tests is not sufficient for these contract requirements. This is a verification gate, not a claim that an untested download or migration is broken.

## Verification

- GitHub PR check `Lint, Build, Test`: passed (run `40916230337`). PR head matches the local reviewed HEAD.
- Local shared-types build: passed.
- Local API SWC build: passed; this does not imply type checking.
- Initial parallel local typecheck, lint, unit and e2e runs reached the 120-second command timeout. The unit run also showed three password-hash test failures before timing out; their cause was not established by that incomplete run.
- Local full-workspace typecheck retry: passed (API and web).
- Local API lint retry: passed.
- Local unit retry (`pnpm --filter @alfahd/api test --maxWorkers=2`): 302 passed, 1 failed. The failure was the 5-second timeout in `src/users/users.service.spec.ts:162` (password change revokes sessions).
- Focused retry (`pnpm --filter @alfahd/api test src/users/users.service.spec.ts --maxWorkers=1`): all 10 passed without increasing the test timeout. This suggests load-sensitive timing, but does not turn the failed full-suite run into a pass or establish a branch regression.
- Local e2e retry (`pnpm --filter @alfahd/api test:e2e --maxWorkers=2`): all 157 tests across 9 files passed.
- Real PostgreSQL/Redis/migration/download acceptance is not verified: `docker compose ps` failed because the Docker Desktop Linux engine pipe was unavailable. Existing router/IP e2e suites use mocked repositories and transactions (`apps/api/test/routers.e2e-spec.ts:37–47`, `apps/api/test/ip.e2e-spec.ts:21–25`), so passing them cannot establish database rollback/locking correctness.

**Summary:** Standards: 2 findings, worst is non-atomic transaction boundaries. Spec: 13 findings, worst includes serialized-stock corruption and IP reservation races. The overlapping findings map to 12 published tickets; the two axes are intentionally reported separately.
