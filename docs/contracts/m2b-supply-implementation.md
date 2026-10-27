# M2b supply implementation contract

- **Recorded:** 2026-10-28
- **Business decisions:** Marwan, confirmed in the implementation-planning discussion
- **Backend delivery:** Ahmed (WS-B)
- **Integration, contract review and migration merge order:** Marwan (WS-P)
- **Status:** Approved business direction; technical freeze items are explicitly listed in §12. This is not an implementation or acceptance report.

## 1. Read this first

This is the handoff for Ahmed or his coding agent. It consolidates Marwan's decisions after the original M2b gap assessment. Read it with the repository's `AGENTS.md` before implementing.

For M2b, the explicit amendments in §2 supersede conflicting statements in `PLAN.md` §3 M2b, `docs/m2b-gap-and-delivery-plan.md`, and the earlier draft cards. All other governing requirements remain applicable. This does not establish client acceptance of the wider statement-of-work scope or change unrelated milestones.

Distinguish three categories:

- **Approved requirement:** implement the behavior described here.
- **Engineering invariant:** enforce the integrity, authorization and atomicity needed to make that behavior correct.
- **Not yet frozen:** propose a concrete technical contract for review before the affected implementation. Do not silently choose a new business policy.

The source tree may still contain old enum values, missing modules or incompatible assumptions. Those are implementation gaps, not reasons to ignore this contract. Do not claim M2b is complete because schemas or test files exist.

## 2. Changes from the earlier plan

| Earlier assumption | Approved M2b requirement |
| --- | --- |
| Router/product/quantity relationship unresolved | Every router references a product/SKU and affects warehouse stock. |
| Registering a serial might be treated as stock receipt | Existing-stock registration and new receipt are different operations; registration must not add stock again. |
| AVAILABLE alone means usable | Usable means lifecycle AVAILABLE, serviceable physical condition, and physically in a warehouse. |
| Damage in a warehouse requires a new lifecycle transition | Track physical condition separately; do not add AVAILABLE → DAMAGED to the lifecycle whitelist. |
| Every router always has one open custody row | Custody can be empty; damaged, repair, lost and decommissioned cases have no current holder. Physical location is separate. |
| Four IP statuses | Exactly FREE and RESERVED; archiving is a separate concern, not a third status. |
| Technician asks a person to approve an IP request | The system automatically allocates and reserves a free address; no human approval queue. |
| Technician IP allocation starts in M2b | Enable it with the ticket milestone, when ticket eligibility/ownership can be validated. |
| Storage must be R2 for this delivery | Prefer Cloudinary with a working download; explicitly configured local disk is the approved temporary fallback. |
| Exact Drizzle package pins | Leave the current dependency versions/ranges unchanged. |

## 3. Scope and existing modules

### Deliver in M2b

- Shared router, holder, physical-condition and IP domain definitions following the tuple convention.
- Additive router, custody, location/condition audit, IP and IP-history schema changes.
- Warehouse guarded soft deactivation.
- Router registration/receipt, read/list/update, manual assignment, lifecycle, condition and location operations.
- Atomic integration with existing quantity inventory and movement history.
- Admin IP management, technician IP read access, and admin-only async CSV import.
- Admin-only async router reports with working downloads, using the shared job pipeline.
- Swagger, shared API contracts, regression tests and real-service integration verification.

### Do not build now

- Customer tables/CRUD, ticket tables/CRUD or ticket closure.
- Technician ticket-based IP allocation endpoint as a usable standalone feature before tickets exist.
- Human IP approval workflows, automatic router assignment on ticket creation, or early customer FKs.
- Replacement product/inventory modules, procurement/accounting systems or new supplier entities.
- M4b `report_jobs` persistence, mobile features or supply frontend screens without a frozen API.

### Reuse these source locations

- Shared types: `packages/types/src/index.ts`.
- Canonical schema: `apps/api/src/database/schema/index.ts`.
- Inventory: `apps/api/src/modules/inventory/` and `apps/api/src/modules/repository/repositories/inventory.repository.ts`.
- Warehouses: `apps/api/src/modules/warehouses/` and the warehouse repository.
- Jobs/status: `apps/api/src/jobs/`.
- Report example: `apps/api/src/attendance/attendance.worker.ts`.
- Storage: `apps/api/src/storage/`.
- Spreadsheet protection: `apps/api/src/common/utils/spreadsheet.utils.ts`.

Generic, non-router inventory behavior must remain compatible. Where serialized routers need different rules, distinguish that path explicitly and review the integration seam before changing public inventory APIs.

## 4. Router domain: lifecycle, condition, custody and location

These are different facts and must not be collapsed into one field:

| Concept | Meaning |
| --- | --- |
| Product/SKU | Catalog definition shared by equivalent devices. Each physical router references one existing product. |
| Router asset | One physical device with a database-unique serial number. |
| Lifecycle status | Its position in the approved assignment/installation/return lifecycle. |
| Physical condition | Whether the device is serviceable, damaged or undergoing repair, independently of lifecycle. Exact field values need technical freeze. |
| Custody | Current responsible holder, if any: WAREHOUSE, TECHNICIAN or CUSTOMER. |
| Physical location | Where it is physically recorded. For damaged/repair devices, support a warehouse or an external repair location description. |

Never erase historical custody to represent empty current custody. Close the existing assignment instead. Never infer that a damaged device has left the warehouse just because its current holder is empty.

### 4.1 Lifecycle whitelist — unchanged

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

- A disallowed lifecycle transition returns 400. A reason never bypasses the whitelist.
- Manual status override requires a reason. An override is a reasoned operation within this whitelist, not a privileged bypass.
- `POST /routers/:id/assign` is ADMIN/WAREHOUSE_STAFF only. A non-AVAILABLE or otherwise unusable router must not be assigned; return a conflict (409).
- Generic router updates must not bypass lifecycle, condition, custody, location or stock invariants.

### 4.2 Warehouse damage without a lifecycle bypass

Example: an AVAILABLE serviceable router is damaged while in warehouse A.

1. Keep lifecycle AVAILABLE.
2. Record physical condition as damaged, preserving actor, timestamp, reason and previous/new condition.
3. Close current custody; no new current holder is created.
4. Retain physical location warehouse A.
5. Remove its contribution to usable stock and include it in warehouse A's damaged count.
6. Reject assignment while it is unserviceable.

Sending it for external repair changes condition/location with audit history, not an invented lifecycle transition. Once repaired and inspected as serviceable, it can become usable again only if its lifecycle is AVAILABLE and it is physically in a warehouse. Restore warehouse custody as part of that usable-warehouse state.

The lifecycle statuses DAMAGED and UNDER_REPAIR still exist and can be reached only via the whitelist. They must never permit usable stock or assignment, even if a condition update is attempted. Define the consistency mapping between these statuses and physical condition before freezing the schema. Do not count a device twice because both status and condition indicate damage.

### 4.3 Custody and location invariants

- Normal new warehouse creation/receipt creates initial WAREHOUSE custody atomically with the asset and stock effects.
- A normal handoff closes the old assignment and creates the next in the same transaction.
- Lifecycle LOST, DAMAGED, UNDER_REPAIR or DECOMMISSIONED has no current custody. Physical damage/repair can also require empty custody while lifecycle stays AVAILABLE, as above.
- Enforce **at most one** open assignment per router using a partial unique index where `released_at IS NULL`. Zero is valid for the empty-custody cases; it is not valid for an otherwise usable warehouse router or normal technician/customer handoff.
- Keep historical assignments, condition changes and location changes auditable. Retain last-known location for lost devices without describing it as verified current warehouse stock.
- Validate actual warehouse/technician targets. Do not create a customer table or FK early; agree future customer-target validation with the later milestone.
- Condition/location operations must not resurrect LOST/DECOMMISSIONED routers or change lifecycle indirectly.

## 5. Stock accounting and onboarding

### 5.1 Usable contribution

A serialized router contributes exactly one usable unit to a warehouse/product pair only when all are true:

1. Lifecycle is AVAILABLE.
2. Physical condition is serviceable.
3. Physical location is that warehouse.

All other states contribute zero usable units. Compute the before/after contribution of each operation and apply its delta once. Returning a router in RETURNED status does not make it usable before inspection and a permitted transition to AVAILABLE.

Examples after serial onboarding has been reconciled:

| Operation | Usable quantity effect |
| --- | --- |
| Receive a new AVAILABLE, serviceable router into a warehouse | +1 |
| Assign a usable warehouse router to a technician | -1 |
| Return a router as RETURNED for inspection | 0 until eligible for AVAILABLE |
| Inspect and make a returned router AVAILABLE/serviceable in a warehouse | +1 |
| Mark an AVAILABLE warehouse router physically damaged | -1 |
| Send an already unusable damaged router for external repair | 0 |
| Receive repaired router into a warehouse and make it eligible for usable stock | +1, exactly once |
| Move an eligible router between warehouses | -1 source, +1 destination, atomically |

The same repaired-router rule must not manufacture an extra inbound receipt. Damaged counts are distinct-device counts at physical locations, separate from usable quantities; repair devices must not appear as usable. Freeze whether displayed condition buckets are exclusive or overlapping, with clear labels.

### 5.2 Existing stock is not a new receipt

Provide distinct semantics for:

- **New receipt:** introduce a new physical unit and apply the appropriate quantity delta.
- **Existing-stock registration:** attach a serial asset to a unit already included in the opening stock; do not increase quantity or fabricate another receipt.

Serial registration must be auditable, unique and safe under retries/concurrency. Before onboarding a router SKU, agree how existing quantities are reconciled to registered serials, how over-registration is prevented, and how damaged units previously counted as usable are corrected through an explicit audited reconciliation. Do not silently overwrite totals, invent serials or automatically convert quantities into assets.

### 5.3 One authoritative write path

- Router, stock quantity, movement audit, custody and condition/location changes belonging to one operation commit or roll back together.
- Reuse existing inventory/movement infrastructure, but not via a separate independently committed transaction.
- Serialize conflicting writes or use equivalent database-atomic updates. Do not read a quantity outside the protected operation and later overwrite a concurrent change with a stale absolute value.
- Prevent quantity-only inbound/outbound/return/transfer/adjustment paths from silently changing serialized stock without matching serial-level operations. Preserve the generic path for other products.
- Record the real authenticated actor. Do not trust a caller-supplied actor ID or use a placeholder actor to satisfy audit requirements.
- Do not change a router's product reference in a way that silently moves stock between SKUs.

The exact SKU classification, reconciliation workflow and movement vocabulary are technical freeze items in §12, not permission to build a second inventory system.

## 6. Warehouse completion

- Replace hard deletion with guarded soft deactivation, preserving the agreed external endpoint behavior.
- Preserve stock and assigned-staff protections.
- Reject deactivation with attached technicians or physically located routers using 409, including damaged/repair routers that have no current custody row.
- Lock/serialize against concurrent router receipt, placement, assignment and inventory operations. Checking once before a separate update is insufficient.
- New placements into inactive warehouses must be rejected.
- Historical inventory, movement, attendance and custody references must remain intact.
- Freeze the handling of last-known-only locations and historical references separately; they must not be mistaken for a physically attached router.

## 7. IP management

### 7.1 Approved representation and permissions

- Individual IPv4 host addresses only; no CIDR ranges or IPv6 in this delivery.
- Use PostgreSQL INET, database uniqueness and suitable query indexes. Enforce IPv4 host semantics in validation and database constraints rather than accepting arbitrary INET networks.
- Exactly two statuses: FREE and RESERVED. RESERVED means in use or allocated and unavailable to another allocation, not merely awaiting human approval.
- Admin alone can create, edit, reserve/release and archive IP records. Technicians can read IP records; their special allocation operation is described below and deferred to tickets.
- Only admin can change RESERVED back to FREE.
- Archive only FREE addresses. Reject archiving a RESERVED address until admin releases it. Archiving is a separate field/operation, not an IP status and not hard deletion.
- Archived addresses must not be allocated. Preserve address uniqueness and history; do not create a second record for an archived duplicate as an import shortcut.
- Preserve nullable `customer_id` as a bare UUID without customer FK until the planned later milestone. Do not add ticket/customer tables to make M2b compile.

### 7.2 History and safe edits

- Each successful actual status change writes exactly one before/after history event in the same transaction.
- Rejected operations write no successful mutation history. Repeated no-op/retry behavior must not create duplicate successful history.
- Audit creation, metadata edits and archival as distinct events where appropriate; preserve the actor, time, object reference, action and changed fields. Do not count a metadata event as a status transition.
- Do not let generic edits bypass reservation rules, change a reserved address underneath an installation, or erase its reservation identity/history. Freeze the allowed edit fields before implementing update DTOs.

### 7.3 Future technician allocation — ticket milestone, not M2b delivery

This section records the agreed future integration so M2b does not create incompatible assumptions:

1. An authenticated technician requests an IP for their current eligible installation ticket.
2. The server validates ticket ownership/eligibility, selects a non-archived FREE address, atomically marks it RESERVED, and returns the allocation to the caller.
3. There is no human approval queue and no technician-facing arbitrary IP status PATCH.
4. Each installation ticket receives at most one reservation. Repeating the request returns that same reservation rather than consuming another address.
5. Competing tickets cannot receive the same IP; competing requests for one ticket cannot consume multiple addresses.
6. Technicians cannot release the address. Admin release/reallocation semantics and exhaustion responses need agreement with the ticket contract.

In M2b, implement the IP foundation and tests without inventing ticket IDs, fake ownership validation or a public allocation endpoint that accepts an unchecked UUID.

## 8. Async CSV import

### Approved behavior

- Admin only. Enqueue through BullMQ; never process the full import on the request thread.
- Enqueue responds with `{ jobId }`; polling eventually returns a result containing `{ inserted, skipped, errors }`.
- CSV headers use the actual approved database column names, not a separate friendly-name scheme. This does not authorize clients to write every column: publish the accepted subset and server-owned defaults explicitly.
- Bounded processing must handle at least 1,000 rows. Do not load an unbounded file or create an unbounded transaction/job payload.
- Duplicate rows within the file, addresses already in the database and concurrent duplicate insertions do not abort valid rows.
- Invalid rows produce row-numbered, client-safe errors; duplicate outcomes must be reported as skips, not successful inserts.
- Use database conflict handling/savepoints or equivalent safe boundaries; catching an SQL error inside an already-aborted transaction is not sufficient.
- Retrying a job must not duplicate inserted addresses/history or misreport its earlier successful inserts as unrelated skips. Keep the completed outcome stable for retries of the same job.
- Preserve requester/admin job authorization. An unsupported import job must not be consumed successfully by the attendance report handler.

### Not yet frozen

Publish an example CSV and exact allowed headers/defaults after schema review. Agree UTF-8/BOM handling, normalization, byte/row limits, batch size, numbering of headers/data rows, error/skip item fields, result pagination/truncation and same-job retry bookkeeping. Agree the additive polling result DTO and import queue dispatch before implementation. Existing `GET /jobs/:id` exposes report download fields only; it does not already support arbitrary import results.

## 9. Router reports and downloads

- Only admins may generate M2b supply reports or import CSVs. Existing attendance authorization must not be accidentally changed by the shared worker refactor; flag any broader role-policy conflict for review.
- Use the existing `reports` queue, job status/ownership pattern, storage abstraction and spreadsheet sanitization utility.
- Introduce explicit job-type dispatch for attendance and router reports. Do not add independently competing report-type workers on the same queue. Fail unsupported types instead of returning an empty successful URL.
- Generate Excel asynchronously. Empty warehouses produce a valid empty report.
- Report warehouse totals must distinguish usable stock, damaged/repair condition and lifecycle, and avoid double counting. Show physical location separately from current custody.
- Completion must provide a working way for the authorized user to download the actual file, not just a storage key, success flag or fake URL.

### Approved storage choice

Try the existing Cloudinary adapter first. Verify that the configured account supports the generated Excel file type and that the returned URL actually downloads readable bytes. Use the correct raw-file/content-type/filename handling as needed; do not assume the existing photo-oriented behavior proves report downloads work.

If Cloudinary cannot meet that requirement, a local-disk adapter is the approved temporary fallback. Make selection explicit and documented, not a silent in-memory or runtime-error fallback. Local files need a configured directory, protected download handling, safe path generation, meaningful filenames/content type, and a documented persistence/cleanup policy. Multi-instance deployments need shared storage or an explicitly acknowledged limitation. Do not weaken unrelated employee-photo storage behavior or production startup checks casually.

Job status and any API-mediated download remain requester/admin scoped. Do not expose another user's file by changing a job ID or file path. Freeze signed/direct URL lifetime or authenticated download routing before delivery. Fake in-memory storage is for tests, not download acceptance. This is an approved M2b deviation from the earlier R2-only storage wording, not a claim of R2 compliance.

## 10. Shared types, API and migrations

- Keep current Drizzle package versions/ranges and lockfile unchanged unless a separately approved compatibility fix is necessary. No exact pinning or dependency upgrades as part of this work.
- Use runtime-light `as const` tuples in `packages/types`; derive unions and PostgreSQL enums from those tuples. Preserve existing object-style router exports where possible.
- Change the old IP tuple/object exports and all affected consumers to FREE/RESERVED deliberately. Do not leave old values as hidden supported aliases. Inspect actual data before proposing any migration mapping; do not guess how ASSIGNED/AVAILABLE/RETIRED should be reconciled.
- At minimum enforce DB serial uniqueness, product references, at-most-one open custody assignment and canonical IP uniqueness. Add indexes for approved filters and location/condition queries.
- Add the router/assignment and IP/history tables plus the condition/location/stock linkage and audit changes needed for this contract. Exact columns and auxiliary tables require schema review, not blind generation from this prose.
- Preserve existing users, products, warehouses, inventory and attendance. No hard-delete endpoints for these new supply entities.
- Migration replay must work on disposable empty and representative existing-data databases. Rebase and regenerate only the branch's unmerged migration artifacts; never delete merged migrations.
- Centralized router operations must accept a caller-owned database transaction for later M3a use. A convenience top-level wrapper may start a transaction; the inner operation must not commit independently.
- New endpoints/DTOs require validation, authentication, explicit approved RBAC, consistent errors, pagination for lists and Swagger. Freeze the OpenAPI fragment before frontend implementation.

## 11. Delivery order and acceptance examples

### Order

1. Review this contract and freeze only the relevant §12 details with Marwan.
2. Shared types and schema proposal; additive migration and serial onboarding/accounting design. Marwan reviews the shared migration before dependents merge.
3. Guarded warehouse deactivation and atomic router/stock/custody/condition/location operations.
4. IP admin/read APIs, audit and archival; then async CSV processing and polling extension.
5. Shared report dispatch, router export and verified downloads.
6. API freeze, regression/concurrency tests, migration replay and real-service smoke evidence.

### Required acceptance scenarios

- [ ] An already-counted unit gains a serial with no extra stock; a genuinely new receipt adds exactly one usable unit when eligible.
- [ ] Duplicate serials, registration retries and competing registrations cannot inflate stock.
- [ ] Two simultaneous assignments of one router cannot both succeed. Failure rolls back router, stock, movement and custody writes.
- [ ] A router damaged in a warehouse keeps lifecycle AVAILABLE, loses current custody, keeps warehouse location, leaves usable stock and appears once in damaged reporting.
- [ ] That router cannot be assigned, including through generic update/inventory endpoints.
- [ ] External repair/location changes preserve history; usable stock is restored once, only after serviceability, warehouse placement and lifecycle eligibility.
- [ ] RETURNED is not usable before inspection. Terminal lifecycle states cannot be resurrected via condition updates.
- [ ] Quantity-only operations cannot bypass serialized accounting; generic product inventory regressions still pass.
- [ ] Warehouse deactivation fails for a physically present damaged router with no custody row, including concurrent placement/deactivation attempts.
- [ ] Every prohibited lifecycle transition returns 400, even with an override reason; assignment conflicts return 409.
- [ ] IP API accepts valid individual IPv4 addresses and rejects CIDR/IPv6, duplicate addresses and unsupported status values.
- [ ] Admin IP mutations have atomic history; technicians can read but cannot create/edit/archive/release or call a premature ticket-allocation endpoint.
- [ ] A FREE IP can be archived and becomes ineligible for allocation; a RESERVED IP cannot be archived before admin release.
- [ ] A 1,000+ row import tolerates duplicates/malformed rows and produces accurate row outcomes; retries and concurrent duplicates preserve data and totals.
- [ ] Only admin can request supply exports/imports. Job status/results and downloads cannot be fetched by another ordinary user.
- [ ] Mixed attendance/router jobs dispatch correctly; unsupported job types fail. Attendance exports still work.
- [ ] Empty warehouse export opens correctly; Cloudinary or configured local storage yields an actual downloadable Excel file.
- [ ] Migrations replay without data loss on empty and existing-data test databases.

Build shared types first, then run from the repository root:

```powershell
pnpm --filter @alfahd/types build
pnpm typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api build
pnpm --filter @alfahd/api test
pnpm --filter @alfahd/api test:e2e
```

Keep hooks enabled. Unit/e2e tests with mocks are not sufficient evidence of PostgreSQL locking/constraints, Redis queue dispatch or real downloads. Use disposable PostgreSQL/Redis and the configured storage provider; never erase a developer's Docker volumes as an unannounced test step. Record actual commands/results, not assumed passes.

## 12. Technical freeze checklist — do not silently invent these

The business direction above is approved. These are remaining affected-work gates, not a reason to stop unrelated tasks:

1. **Router schema and consistency:** exact physical-condition values, lifecycle/condition mapping, location representation/history, custody restoration rules, and exceptional location updates. Do not expand the lifecycle whitelist.
2. **Serialized inventory integration:** SKU classification, serial onboarding/reconciliation capacity, movement types/linkage, lock order and protection against quantity-only bypasses. Freeze before receipt/registration writes.
3. **Remaining RBAC:** exact router read/write/condition/location permissions beyond manual assignment; CS and WAREHOUSE_STAFF IP read access has not been approved. Deny unapproved access rather than infer broad permissions.
4. **IP/admin DTOs:** allowed edit fields, reservation metadata, mutation reasons and no-op response semantics. Keep technician allocation deferred and coordinate its release/retry rules with tickets later.
5. **CSV:** actual DB-column header subset and defaults, examples, encoding/limits, error/skip row format, retry bookkeeping and result polling contract.
6. **Reports:** exact router job discriminator/payload/filter/output columns, polling additions, download route/URL security and Cloudinary-versus-local verification. Retain existing attendance compatibility.
7. **API freeze:** routes other than the existing planned router assignment route, DTO fields, pagination and exact error bodies; publish the reviewed OpenAPI snapshot.

An agent may propose these technical details, but must obtain review before treating them as frozen behavior. Do not reinterpret an unresolved technical detail as approval for new scope.

## 13. Prompt Ahmed can give his coding agent

> Implement M2b against `docs/contracts/m2b-supply-implementation.md`. Read `AGENTS.md`, inspect the current source and existing tests, and identify conflicts with the older plan. Preserve generic inventory and existing data. First present a small dependency-ordered implementation plan and the affected §12 technical proposals for review; do not guess missing business rules. Keep lifecycle, physical condition, custody and location distinct. Link routers to product stock atomically, distinguish existing registration from receipt, use only FREE/RESERVED for IPv4, and defer technician allocation until tickets exist. Reuse shared jobs/storage, verify real downloads, keep dependencies unchanged, and do not commit/push unless asked. Report verification evidence and unresolved items honestly.
