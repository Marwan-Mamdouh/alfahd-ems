# M2b Supply Chain — Gap and Delivery Plan

**Prepared:** 2026-10-26  
**Baseline:** local `master`, commit `4ab11ae`  
**Feature owner:** Ahmed (WS-B, Supply)  
**Integration and decisions:** Marwan (WS-P)

## 1. Purpose and evidence limits

Finish M2b without rebuilding the existing inventory modules or confusing generic stock with individual router assets. This document compares the current source with `PLAN.md` §3 M2b and its global rules; it does not replace those requirements.

This is a source-based planning assessment, not an acceptance report. Tests, migrations, a running app and staging were not executed for this assessment. Existing code and test files are evidence of implementation, not proof that a milestone is done. Earlier statements that M1 and M2a were fully complete were not sufficiently verified.

## 2. Existing inventory versus M2b

| Area | What it means | Current source evidence | M2b action |
| --- | --- | --- | --- |
| Product catalog | Product/SKU definitions, model, category and low-stock threshold | `apps/api/src/modules/products/`; `products` schema | Reuse; do not rebuild |
| Quantity inventory | Quantity of each product in each warehouse | `warehouse_inventory` schema; `apps/api/src/modules/inventory/` | Preserve existing behavior |
| Stock movements | Quantity movements: inbound, outbound, returns, transfers and adjustments | `stock_movements` schema and inventory module | Preserve; settle router integration before changing |
| Warehouses | Shared warehouse records, location, manager and active flag | `apps/api/src/modules/warehouses/` | Reuse and harden |
| Router assets | One physical router identified by a unique serial, with lifecycle status | Shared status constants exist; no router table or implementation found | Build |
| Router custody | Which warehouse, technician or customer currently holds each router | Shared holder constants exist; no assignment table found | Build |
| IP management | Individual IP address, status and mutation history | Shared IP status constants exist; no IP tables or implementation found | Build |
| Router report | Asynchronous router inventory export | Attendance export infrastructure exists, but no router report | Extend shared pipeline |

**Example:** stock inventory answers “how many units of product X are in warehouse A?” Router assets answer “who holds router serial SN-123, and what happened to it?” An existing technician stock movement is not a substitute for serial-level router custody.

Generic inventory is already implemented beyond the router-only description in the master plan. Preserve it. Marwan must reconcile that scope with the governing documents rather than deleting it or treating its existence as proof that all M2b requirements are satisfied.

## 3. What is missing or incomplete

| Requirement | Current finding | Remaining work |
| --- | --- | --- |
| Warehouse CRUD | Controller, service, repository and tests exist | Verify acceptance and preserve API compatibility |
| No hard deletes | `WarehousesService.remove()` calls inherited `deleteById()`, which executes a DB delete | Change warehouse removal to guarded soft deactivation |
| Warehouse removal guards | Repository checks positive stock and assigned staff, not routers | Preserve current protections; add router attachment checks and concurrency protection |
| Shared domain values | `RouterStatus`, `RouterHolderType`, `IpStatus` exist as `as const` objects in `packages/types/src/index.ts` | Align with the plan's shared-tuple convention without breaking existing exports; derive DB enums from one source |
| Router schema | No `routers` or `router_assignments` tables in the canonical schema | Add schemas, indexes, constraints and generated migration |
| Router endpoints | No router controller/service/module found | Add CRUD semantics without hard deletion, validation, RBAC and Swagger |
| Router lifecycle | No transition implementation found | Implement the exact transition matrix in one transactional service |
| Router custody | No assignment implementation found | Initial warehouse row; atomic old-row release and new-row creation |
| Manual assignment | No serial-level assignment endpoint found | Implement `POST /routers/:id/assign`; role checks and unavailable-router conflict |
| Router report | Missing | Add job payload, worker handler, export and polling integration |
| Reusable job routing | `AttendanceReportWorker` consumes `reports`; unknown job types return an empty successful result | Introduce explicit job-type dispatch; never add competing workers that can consume the wrong report type |
| IP schema/API | No `ip_addresses` or `ip_history` tables/controllers found | Add INET storage, validated operations and transactional history |
| CSV import | No IP bulk importer found | Asynchronous, bounded processing with per-row outcomes and duplicate tolerance |
| Contract cards | No `docs/contracts/` directory found | Publish and freeze `report-pipeline`, `router-transition` and supply OpenAPI contracts |

### Existing infrastructure to reuse

- Canonical schema: `apps/api/src/database/schema/index.ts`.
- Warehouse service and repository: `apps/api/src/modules/warehouses/warehouses.service.ts` and `apps/api/src/modules/repository/repositories/warehouses.repository.ts`.
- Job status and ownership checks: `apps/api/src/jobs/jobs.service.ts` and `jobs.controller.ts`.
- Attendance export example: `apps/api/src/attendance/attendance.worker.ts`.
- Storage abstraction: `apps/api/src/storage/storage.interface.ts`.
- Spreadsheet sanitization: `apps/api/src/common/utils/spreadsheet.utils.ts`.
- Existing warehouse, product and inventory unit/e2e suites for regression coverage.

## 4. Decisions to settle before affected implementation

Marwan and Ahmed should record these answers in the feature specification or contract cards. They are blockers for the affected issue, not reasons to stop unrelated work.

1. **Router versus stock accounting:** Is each router linked to a product? Do router receipt, assignment, return and transfer also change quantity inventory? Define the authoritative source and atomic updates so one device cannot be counted twice. Do not silently invent this link or migrate stock quantities into serials.
2. **Holder semantics:** Specify the holder after each transition, especially `DAMAGED`, `UNDER_REPAIR`, `LOST` and `DECOMMISSIONED`. Decide how a future customer reference is represented without creating the M3a customer table early. An inactive status and physical custody are different facts.
3. **Overrides:** A reason is mandatory, but M2b also forbids transitions outside its whitelist. Treat override as a reasoned operation within the whitelist unless an explicit decision changes the governing plan; do not add a bypass.
4. **IP rules:** Confirm allowed status transitions, reservation meaning, assignment inputs, mutation reasons and whether CIDR/network addresses are accepted or only host addresses. Specify history actions for retirement and manual changes, not just assignment/release.
5. **CSV contract:** Freeze headers, normalization, encoding, size/row limits, row-numbered errors, retries, duplicate behavior and result format. Because global rules require bulk row processing in BullMQ, propose an enqueue response with job ID and a completed result `{ inserted, skipped, errors }`; approve its polling shape explicitly.
6. **Authorization:** Manual router assignment is ADMIN/WAREHOUSE_STAFF. Confirm the read/write/report/import permission matrix for remaining operations; do not guess technician or CS access.
7. **Report storage:** Current storage uses Cloudinary/fake implementations, while `PLAN.md` specifies R2. Record an approved provider decision or deliver the required adapter; do not describe the current pipeline as R2-compliant.
8. **Versions:** `apps/api/package.json` declares `drizzle-orm: ^0.45.2` and `drizzle-kit: ^0.31.10`, unlike the plan's instruction to pin both to 0.45.2. Marwan must verify compatible actual versions against the lockfile and correct the plan/pins; do not assume both packages share version numbers.

## 5. Delivery sequence and owners

### Step 1 — Contracts and scope (Marwan + Ahmed)

- [ ] Resolve the decisions above before implementing dependent behavior.
- [ ] Freeze the existing report queue, payload, ownership, status, result and error contracts in `docs/contracts/report-pipeline.md`.
- [ ] Draft the supply API and shared DTOs, including errors and pagination. Freeze each fragment before frontend implementation against it.
- [ ] Define `docs/contracts/router-transition.md`: inputs, current/next holder, reason, actor, transaction context and failure semantics.
- [ ] Design the transition service so M3a can pass its existing database transaction; it must not independently commit router changes during ticket closure.

**Exit:** Ahmed has agreed contracts; Marwan has resolved shared-schema, version and stock-accounting boundaries.

### Step 2 — Domain schema and migration (Ahmed; Marwan reviews/merges)

- [ ] Add the shared router status, holder type and IP status definitions using the agreed single-source convention.
- [ ] Add `routers`, `router_assignments`, `ip_addresses`, `ip_history` with approved fields and timestamps.
- [ ] Enforce router serial uniqueness in PostgreSQL, not just a pre-insert lookup.
- [ ] Enforce at most one open assignment per router with a partial unique index on rows where `released_at IS NULL`; service transactions must also ensure an assignment exists.
- [ ] Use PostgreSQL `INET` with database uniqueness for IP addresses and indexes supporting approved queries.
- [ ] Keep `ip_addresses.customer_id` a bare nullable UUID, with no customer FK until M4a.
- [ ] Add actor, timestamp and before/after statuses to IP mutation history; freeze additional fields in the spec.
- [ ] Generate and review an additive migration that preserves existing users, warehouses, products, stock and attendance.
- [ ] Rebase and regenerate only this branch's unmerged generated migration artifacts according to the migration policy; never remove already-merged migrations.

**Exit:** migration replay succeeds on a disposable empty database and a database containing representative existing data. Marwan merges the schema before dependent issues start.

### Step 3 — Warehouse completion (Ahmed)

- [ ] Replace warehouse hard deletion with soft deactivation while preserving the agreed external endpoint contract.
- [ ] Preserve stock and staff protections; reject removal/deactivation with attached technicians or routers using 409.
- [ ] Define attachment consistently with the holder contract and protect against assignment/deactivation races.
- [ ] Test that warehouse history, stock movements and references remain intact.

### Step 4 — Router lifecycle and custody (Ahmed)

- [ ] Build router create/read/list/update operations with approved validation and RBAC; no hard-delete path.
- [ ] Create the router and initial warehouse assignment in the same transaction.
- [ ] Centralize all status transitions and holder handoffs; generic updates must not bypass lifecycle logic.
- [ ] Implement manual assignment and reason-required status operations.
- [ ] Serialize competing operations using row locks or an equivalent atomic strategy; losing assignments return a conflict without orphaned history.
- [ ] Close the old assignment, insert the new one and update status atomically, including rollback on any failed write.
- [ ] Export the transaction-aware transition interface for later M3a use, without implementing tickets now.

### Step 5 — IP management and import (Ahmed)

- [ ] Build validated IP create/read/list/update/status operations; retirement replaces hard deletion.
- [ ] Write exactly one history record per successful status mutation in the same transaction. Rejected mutations produce no history; define no-op behavior in the approved contract.
- [ ] Implement CSV processing through BullMQ with bounded batches and safe per-row validation.
- [ ] Handle duplicates within the file, already stored addresses and concurrent inserts without aborting valid rows. Use DB conflict handling; a caught SQL error must not poison the batch transaction.
- [ ] Return the approved completed import result with row-numbered errors; verify a file of at least 1,000 rows.
- [ ] Define retries/idempotency so retried jobs do not duplicate successful history or incorrectly report inserted rows.

### Step 6 — Router report and shared job dispatch (Ahmed; Marwan reviews shared changes)

- [ ] Refactor the `reports` consumer to dispatch explicitly to attendance/router handlers; reject unsupported types rather than succeeding with an empty URL.
- [ ] Enqueue router exports using the frozen payload and existing requester ownership pattern.
- [ ] Generate Excel asynchronously, sanitize user-controlled cells and upload through the agreed storage adapter.
- [ ] A warehouse with zero routers produces a valid empty report rather than failing.
- [ ] Keep attendance reports and `GET /jobs/:id` authorization working after the refactor.
- [ ] Do not introduce the M4b `report_jobs` persistence table.

### Step 7 — Integration and handoff (Marwan + Ahmed)

- [ ] Complete Swagger documentation and freeze supply OpenAPI snapshots for frontend handoff.
- [ ] Run unit, e2e, migration and real-service smoke checks; record results against the DoD below.
- [ ] Merge small PRs in dependency order: shared contracts/types → schema → warehouse/router/IP features → jobs/report integration.
- [ ] Preserve generic inventory behavior and existing API contracts unless a reviewed change explicitly supersedes them.

## 6. Definition of Done (DoD)

M2b is done only when all applicable checks pass and blocking decisions are resolved. These are the remaining acceptance checks, not claims about current completion.

### Router rules

- [ ] Status values are exactly `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, `DECOMMISSIONED`.
- [ ] The only allowed transitions are:

  | From | Allowed destinations |
  | --- | --- |
  | AVAILABLE | ASSIGNED_TO_TECHNICIAN |
  | ASSIGNED_TO_TECHNICIAN | INSTALLED_AT_CUSTOMER, RETURNED, DAMAGED, LOST |
  | INSTALLED_AT_CUSTOMER | RETURNED |
  | RETURNED | AVAILABLE, UNDER_REPAIR, DAMAGED |
  | DAMAGED | UNDER_REPAIR, DECOMMISSIONED |
  | UNDER_REPAIR | AVAILABLE, DECOMMISSIONED |
  | LOST | None |
  | DECOMMISSIONED | None |

- [ ] Every disallowed transition returns 400; a reason never bypasses the whitelist.
- [ ] Router creation inserts the initial WAREHOUSE holder row, and duplicate serials are blocked by a DB unique constraint.
- [ ] Every status change atomically releases the old assignment and inserts the next; one current row has `released_at IS NULL`.
- [ ] Holder types are exactly WAREHOUSE, TECHNICIAN and CUSTOMER, with targets validated according to the approved contract.
- [ ] `POST /routers/:id/assign` permits ADMIN/WAREHOUSE_STAFF only; a non-AVAILABLE router returns 409.
- [ ] Manual status override requires a reason.
- [ ] Concurrent assignment cannot create two current holders, and failed transactions leave status/custody unchanged.

### Warehouse, IP and reporting rules

- [ ] Warehouse CRUD is verified; removal with technicians or routers attached returns 409, without hard-deleting records.
- [ ] Existing stock safeguards and generic inventory regression tests still pass.
- [ ] IP addresses use unique, indexed INET storage; statuses are AVAILABLE, ASSIGNED, RESERVED and RETIRED.
- [ ] Every successful IP status mutation creates exactly one before/after history record atomically.
- [ ] Import processes at least 1,000 rows asynchronously and produces `{ inserted, skipped, errors }` through the approved job contract.
- [ ] Duplicate or malformed rows do not abort valid rows; import retry behavior is verified.
- [ ] `ip_addresses.customer_id` remains a nullable UUID without a customer FK.
- [ ] Router reports reuse the shared queue/status/storage pipeline and handle an empty warehouse.
- [ ] Mixed attendance and router jobs reach the correct handlers; unsupported job types cannot silently complete successfully.
- [ ] API authentication, agreed RBAC, validation, error shapes and Swagger are covered; job results remain requester/admin scoped.
- [ ] Migrations work against both empty and existing-data databases without data loss.

### Verification commands and environment

Run from the repository root, building shared types first:

```powershell
pnpm --filter @alfahd/types build
pnpm typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api build
pnpm --filter @alfahd/api test
pnpm --filter @alfahd/api test:e2e
```

Unit/e2e suites alone do not prove PostgreSQL constraints, concurrency or real queue behavior. Add a documented integration check using disposable PostgreSQL/Redis and the agreed storage provider for migration replay, concurrent assignments, canonical IP duplicates, imports and mixed reports. Never run `docker compose down -v` against a developer's existing data as an unannounced test step. Pre-commit hooks must remain enabled.

## 7. Not part of this M2b delivery

- Rebuilding or replacing existing products, warehouse quantity inventory or stock movement modules.
- Customer CRUD or a customer table, ticket CRUD, install-ticket closure and customer deactivation IP release: later milestones own those implementations.
- Customer foreign keys before M4a, or M4b `report_jobs` persistence.
- Automatic router assignment on ticket creation: assignment remains manual.
- GPS streaming, live maps, FCM/push or mobile screens.
- New supplier/procurement/accounting systems or unapproved balancing/stock policies.
- Claiming the entire M1 or M2a milestone is accepted based solely on source files.

Supply frontend screens may be planned separately after the corresponding OpenAPI fragment is frozen; they are not implicitly included in Ahmed's backend completion checklist.

## 8. Immediate starting tasks

**Marwan:** resolve stock-versus-router ownership and storage/version discrepancies, agree the permission matrix, and freeze the shared contracts with Ahmed.

**Ahmed:** draft router/IP schemas and transition/holder semantics, inspect existing warehouse tests, then deliver the additive migration and guarded warehouse deactivation before building the dependent lifecycle/import/report features.

**Frontend developer:** continue independent shell work and verified existing integrations; start supply screens only against the agreed frozen API, not against route constants or assumed endpoints.
