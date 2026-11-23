# Phase 2 integration handoff — owner-approved decisions

**Issue:** #67 (A2), part of #65. **Audited source baseline:** `1ab7655dbf3571efc704e4707fc4af63820171b2`. **Status:** owner-approved decisions; freeze verification on the eventual merged result is pending. This is not an acceptance report or a claim of named reviewers' approval. @Marwan-Mamdouh is accountable; @Hamadaae reviews supply and API integration; @bahaashahin reviews UI contracts. #66 is closed.

The owner authorized **Terra** as substitute for the supply and UI review lanes for this contract handoff. Terra's supply disposition: the documented roles, wire envelopes, pagination and outstanding manager, historical-name and product work are suitable for handoff subject to the stated future-work and merged-verification gates. Terra's UI disposition: the documented state, selector, photo and download seam semantics are suitable for handoff subject to the sibling types implementation and merged verification. These dispositions are Terra's, not approvals by @Hamadaae or @bahaashahin; their ongoing implementation and ownership responsibilities remain unchanged.

## Changes since the previous draft

- Master now implements attendance list/history, employee lookup and product soft-deactivation. The [wire catalog](phase-2-wire-contracts.md) describes what is implemented; the [decision register](phase-2-proposed-contracts.md) distinguishes owner-approved directions from implementation work still needed.
- Router creation now maps its initial warehouse assignment into the returned DTO. For serviceable onboarding, the creation response carries warehouse custody consistently with subsequent reads; duplicate-serial races map to 409. Keep the existing customer-installation exclusion.
- Warehouse deactivation now also guards active custody, not just inventory, staff and physically located routers. Do not offer deactivation based only on visible warehouse stock.
- Auth/session behavior changed: refresh rotation updates the HTTP-only cookie; logout revokes the user's sessions. Containers must use the current shared auth adapter, not copy earlier assumptions that refresh never rotates. This does not authorize a new auth implementation in #67.

[The standalone OpenAPI snapshot](phase-2-openapi.json) is a generated artifact of `generate-phase-2-openapi.mjs`, built from curated observations of the audited source, not generated Nest Swagger. [Supplementary fragments](phase-2-openapi-fragments.md) provide history, multipart and download detail. Neither proves live-response conformance. The eventual merged SHA is not yet known; record it externally with verification after merge, not as a self-referential claim in this artifact.

Attendance clarification: employee-specific history belongs on the employee page and is not restricted by department; the overall ADMIN list retains a current-department filter. The API's contextual `totals` ignore status, but the approved UI cards count all matching records across pages, including the status filter. The container derives the cards from `filteredTotal` and `totals` without changing the API or fetching all pages.

## Boundaries and working agreement

Scope: employees, attendance, warehouses, products and quantity inventory, serialized routers, IPv4, related asynchronous imports, reports and downloads. Excluded: ticket/CRM/customer CRUD, installation custody handoff, ticket-based technician IP allocation, live tracking, mobile, procurement/accounting and new deployment infrastructure. Do not invent APIs for exclusions. This integration does not establish client acceptance of the wider inventory scope.

Backend developers own `apps/web` API functions, query hooks, network-aware containers, authentication/error mapping, polling, downloads, mutations and cache invalidation. @bahaashahin owns prop-driven components, forms, interaction states, styling and responsive/RTL presentation. Agree interfaces before cross-owner edits; backend owners compose components into production pages. Use separate branches/worktrees and designate a single writer for shared types, query infrastructure, permissions, schemas/migrations and page composition in each handoff. Do not concurrently edit a shared page container without coordination. Preview screens and their data are not production integration.

## Wire format and transport

Paths below are API paths. The browser uses the server-side `/api/*` rewrite and bearer authentication; API guards are authoritative. `ResponseInterceptor` wraps ordinary results as `{ "data": payload }`, **except** an object already containing both `data` and `meta` passes through. Thus employee pagination is `{data: [...], meta: {...}}`, whereas supply list payloads are `{data: {items: [...], total: n}}`. A 204 response has no body; local report downloads return binary rather than JSON. See `apps/api/src/common/interceptors/response.interceptor.ts` and `jobs/jobs.controller.ts`.

The global exception filter emits `{statusCode, message, error: {code, message, details?}, path, timestamp}`. Validation messages are joined into a string; the default code is `ERROR`, not a guaranteed domain-specific code. Oversize multipart files return 400 with `FILE_TOO_LARGE`. Handle 401, 403, 400, 404, 409 and network/5xx separately as applicable; do not assume every endpoint emits every status or parse message text as a stable code. Never blindly retry mutations. Job downloads must retain authorization; do not treat a job ID as authorization.

Historical `specs/005-m2a-hr-attendance/contracts/api-contracts.md` is useful context but its error examples omit the current outer fields; follow the filter above. Its illustrative DTO examples can omit fields; use the shared DTO and mapper, not examples as a complete schema. Swagger at `/-json` is generated in non-production, but missing decorator metadata means it is not a complete validated contract snapshot.

## Current action and permission matrix

`A` = ADMIN, `W` = WAREHOUSE_STAFF, `C` = CS, `T` = TECHNICIAN. These describe source at the baseline, not permission to add routes. `JwtAuthGuard` enforces `@Roles` metadata; some controllers additionally use `RolesGuard`. The UI must not copy its current broad `*.manage` permissions as the server matrix.

| Method and path | Action | Roles / special rule | Input / output |
| --- | --- | --- | --- |
| POST /employees | Create | A | `CreateEmployeeRequestDto` → 201 `EmployeeDto` |
| GET /employees | List | A | `EmployeeQueryRequestDto` → employee `data` + `meta` |
| GET /employees/lookup | Minimal selector data | A, W | `EmployeeLookupQueryRequestDto` → `{data: EmployeeLookupDto[]}` |
| GET /employees/:id | Detail | A or self | → `EmployeeDto` |
| PATCH /employees/:id | Update profile | A | `UpdateEmployeeRequestDto` → `EmployeeDto` |
| PATCH /employees/:id/status | Change status | A | `{status, reason}` → `EmployeeDto` |
| POST /employees/:id/photo | Upload | A | multipart `file` → 200 `{profilePhotoKey, url}` |
| GET /attendance | List / employee history | A | `AttendanceListRequestDto` → `{data:{items,page,pageSize,filteredTotal,totals}}` |
| POST /attendance/check-in | Check in | T | `{lat,lng}` → 201 `AttendanceRecordDto` |
| POST /attendance/check-out | Check out | T | → 200 `AttendanceRecordDto` |
| PATCH /attendance/:id | Override | A | `OverrideAttendanceRequestDto` → `AttendanceRecordDto` |
| GET /attendance/report | Enqueue report | A | `AttendanceQueryRequestDto` → 202 `{jobId}` |
| GET /warehouses, GET /warehouses/:id | List / detail | A, W, C | `QueryWarehousesDto` for list → `{items,total}` / warehouse |
| POST /warehouses, PATCH /warehouses/:id | Create / update | A | `CreateWarehouseDto` / `UpdateWarehouseDto` → warehouse |
| DELETE /warehouses/:id | Guarded deactivation | A | → 204; not a hard-delete UI promise |
| GET /products, GET /products/:id | List / detail | A, W, C, T | `QueryProductsDto` for list → `{items,total}` / product with stock |
| POST /products, PATCH /products/:id | Create / update | A, W | `CreateProductDto` / `UpdateProductDto` → product |
| DELETE /products/:id | Guarded soft-deactivation | A | → 204; stock or active router blockers → 409 |
| GET /inventory, GET /inventory/warehouses/:warehouseId | Stock reads | A, W, C | `QueryInventoryDto` → `{items,total}` |
| POST /inventory/inbound, /outbound, /returns | Stock movement | A, W | respective stock DTO → 201 `{data:{inventory,movement}}` |
| POST /inventory/transfer | Transfer | A, W | `TransferStockDto` → 200 `{data:{sourceInventory,destInventory}}` |
| POST /inventory/adjust | Adjustment | A | `AdjustStockDto` → 200 `{data:{inventory,movement}}`; nonempty `notes` required |
| GET /inventory/movements, GET /inventory/movements/:id | Movement list / detail | A, W | `QueryStockMovementsDto` for list |
| POST /routers | Register existing unit or receive new unit | A, W | `CreateRouterDto` → 201 `RouterDto` |
| GET /routers, GET /routers/:id | List / detail | A, W, C, T | `RouterQueryDto` → `{items,total}` / `RouterDto` |
| POST /routers/:id/assign | Assign to technician | A, W | `AssignRouterDto` → 200 `RouterDto` |
| PATCH /routers/:id/transition, PATCH /routers/:id/condition | Lifecycle / physical condition | A, W | respective DTO → `RouterDto` |
| GET /routers/:id/assignments, /condition-history, /status-history | Audit histories | A, W | arrays |
| POST /routers/export | Enqueue router report | A | `RouterReportQueryDto` → 200 `{jobId}` |
| GET /ip-addresses, GET /ip-addresses/:id | List / detail | A, T | `IpQueryDto` → `{items,total}` / `IpAddressDto` |
| POST /ip-addresses | Create | A | `{address, notes?}` → 201 `IpAddressDto` |
| PATCH /ip-addresses/:id | Edit metadata | A | `{notes?}` → `IpAddressDto` |
| POST /ip-addresses/:id/reserve, /release, /archive, /unarchive | State / archival | A | `{reason?}` → 200 `IpAddressDto` |
| GET /ip-addresses/:id/history | Audit | A | → `IpHistoryDto[]` |
| POST /ip-addresses/import | CSV import | A | multipart `file` → 202 `{jobId}` |
| GET /ip-addresses/import/:id | Import outcome | A, additionally job authorization | → `JobStatusResponseDto` |
| GET /jobs/:id, GET /jobs/:id/download | Poll / local report bytes | requester or A, per service | → `JobStatusResponseDto` / authorized XLSX bytes |

See controller and DTO directories in `apps/api/src/{employees,attendance,jobs}` and `apps/api/src/modules/{warehouses,products,inventory,routers,ip-management}` for exact validation and service-dependent conflicts. Shared response and router/IP DTOs are in `packages/types/src/index.ts`; supply inventory/product/warehouse results originate in the schema and repositories. No claim is made that generated OpenAPI completely represents these types.

## Filtering and pagination

| Surface | Accepted parameters | Pagination / wire result |
| --- | --- | --- |
| Employees | `role`, `department`, `status`, `warehouse_id`, `q` | `page` default 1; `pageSize` default 20, max 100; top-level `data`, `meta: {page,pageSize,total}` |
| Employee lookup | `role`, `warehouseId` (legacy `warehouse_id`), `status`, `q` | `limit` default 50, max 100; name order, no offset or total |
| Attendance list | `from`, `to`, `employee_id`, `department`, `status` | `page` default 1; `pageSize` default 20, max 100; `filteredTotal` for pagination; contextual `totals` ignore status |
| Attendance report | required ISO 8601 `from`, `to` (ordered range of at most 366 days); optional `department`, `employee_id` | job result, not a list; over-limit range → 400 `DATE_RANGE_EXCEEDS_MAXIMUM` |
| Warehouses | `search` | `limit` default 20, max 100; `offset` default 0; `{data:{items,total}}` |
| Products | `search`, `category`, `isLowStock`, `activeOnly`, `isActive` | same limit/offset envelope |
| Inventory | `warehouseId`, `productId` | same limit/offset envelope |
| Movements | `warehouseId`, `productId`, `movementType`, `technicianId` | same limit/offset envelope; inspect service for result DTO |
| Routers | `status`, `physicalCondition`, `warehouseId`, `productId`, `search` | `page` default 1; `limit` default 20, max 100; `{data:{items,total}}` |
| IP addresses | `status`, `isArchived`, `search` | same page/limit envelope |

Do not derive page count from `items.length`; use `total`. Router status, physical condition, physical location and custody are distinct facts. Existing-stock router registration (`isNewReceipt` omitted/false) is not a receipt; true is a new receipt. See `serialized-inventory-consistency.md` before wiring mutations. IP status is FREE/RESERVED; archival is separate. CSV format and limits are in `ip-csv-import.md`. Report storage and authenticated download limitations are in `local-report-storage.md`.

## Source-shaped examples (synthetic, illustrative)

The detailed request/response catalog with populated examples is [phase-2-wire-contracts.md](phase-2-wire-contracts.md). The typed UI proposal and fixtures are in `apps/web/src/phase2-handoff/`; they are independently typechecked. Terra's authorized substitute UI disposition covers the handoff; verify the actual sibling types on the merged result.

These are wire envelopes, not complete object schemas or evidence of a live HTTP test:

```json
{"data":[],"meta":{"page":1,"pageSize":20,"total":0}}
```

```json
{"data":{"items":[],"total":0}}
```

```json
{"data":{"jobId":"synthetic-job-id"}}
```

```json
{"statusCode":403,"message":"Insufficient role","error":{"code":"ERROR","message":"Insufficient role"},"path":"/ip-addresses","timestamp":"2026-11-07T00:00:00.000Z"}
```

Example request fragment: `POST /ip-addresses` with JSON `{ "address": "192.0.2.1", "notes": "synthetic example" }`; ADMIN only, 201 wraps the returned `IpAddressDto` in `data`. The wire catalog gives additional examples; verify the catalog against the merged result.

## Owner-approved prop/callback seam semantics

The following is illustrative vocabulary, not an API DTO or a claim about peer type names. The sibling types lane implements the seam. Backend containers adapt actual DTOs to UI view models; UI receives supplied state and invokes callbacks, never calls the API itself. Avoid using `apps/web/src/components/routers/types.ts` status aliases as backend statuses.

```ts
type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: () => void }
  | { kind: 'ready'; value: T };
type Page<T> = { items: readonly T[]; total: number; page: number; pageSize: number };
type ActionState = { pending: boolean; error: string | null };
type ListProps<Row, Filters> = {
  state: LoadState<Page<Row>>;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onPageChange: (page: number) => void;
};
type FormProps<Values> = {
  initialValues: Values;
  action: ActionState;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
};
```

Empty results are distinct from errors and loading. Each action has its own pending and error state. Manager choices include active eligible people; an existing inactive or unknown assignment is retained as current-only and preserved on unrelated edits, not offered as a new eligible choice. Supplied names include inactive people where resolvable; otherwise display “Name unavailable”, not a fabricated name. After employee creation, a failed upload can be retried against the saved employee ID without re-creating the employee; upload retry is distinct from image display/load fallback. The container downloads reports by job ID using authorization; the ID is not authorization. These are approved semantics, not claims that the future API work or sibling implementation has shipped.

## Decision and acceptance gates

| Gate | Responsible owner / handoff | Required before |
| --- | --- | --- |
| Attendance reads: implemented ADMIN list/history; UI cards count all matching records across pages | @Marwan-Mamdouh with @bahaashahin; #69/#71/#83 | review rows, card mapping, filters, timezone and empty/error states against the merged endpoint |
| Lookup: broader ADMIN/W read approved; manager eligibility and historical name resolution are separate | @Hamadaae with @Marwan-Mamdouh; #75/#84/#77/#79 | review manager selector and server-side validation, warehouse write permissions and authorized history names |
| Photo display: authorized employee list/detail resolve public `photoUrl: string \| null` in the API; container passes it through | @Marwan-Mamdouh with @bahaashahin; #73 | confirm the UI seam; verify provider configuration, replacement/cache behavior and fallback in #73 |
| Product soft-deactivation: four-state guard approved; inactive selectors/writes and ADMIN reactivation still need work | @Hamadaae with @Marwan-Mamdouh and @bahaashahin; #81 | Terra's substitute dispositions cover the handoff; verify the owner-approved `POST`/`204` contract, safeguards and UI handoff on the merged result; #81 owns delivery |
| Formal acceptance environment | @Marwan-Mamdouh; #89 | staging waived by the issue owner for this Phase 2 only; use a local/demo browser run with real PostgreSQL, Redis and configured storage through the Next `/api` rewrite, using disposable synthetic fixtures. Still run #89 and record results, exact environment and limitations. Not production/staging validation or approval to deploy |
| Per-action contract, examples/OpenAPI and sibling seam types | @Marwan-Mamdouh accountable; ongoing supply/UI ownership remains with @Hamadaae / @bahaashahin; #67 | Terra's authorized substitute dispositions are recorded above; verify the merged result before marking A2 frozen |

The API grants IP reads to ADMIN and TECHNICIAN. Check action visibility in production composition under #88 rather than treating preview visibility or client permission constants as authoritative.

## Review and closure evidence

Before closing #67, verify the matrix, wire catalog, sibling types and outstanding technical gates on the exact merged result, record the merged PR/commit, environment and actual focused test commands/results, and obtain the owner's freeze decision. The owner authorized Terra's substitute dispositions above; no further named human approval is a prerequisite for the handoff. They do not constitute approval by the other developers or proof that implementation is complete. #89 remains separate. Existing A1 evidence in #66 is baseline evidence only. Do not close on an unmerged draft.

Local review verification on Windows, Node `24.22.2`, pnpm `12.6.0`, master `0ee2118` plus these handoff files: `pnpm install --frozen-lockfile`, `pnpm --filter @alfahd/types build`, `pnpm typecheck`, and `pnpm --filter fahd-dashboard lint` passed. `pnpm --filter @alfahd/api exec vitest run src/attendance/attendance-list.spec.ts src/employees/employees.service.spec.ts src/modules/products/products.service.spec.ts src/common/interceptors/response.interceptor.spec.ts` passed 33 tests. The OpenAPI generator emitted 54 operations across 43 paths. These are local draft checks, not merged-head CI, live-service/browser verification or reviewer approval.

Historical verification on Windows, Node `24.22.2`, pnpm `12.6.0`, 2026-11-08, baseline `7606270` plus uncommitted handoff files (not a test pass for the 2026-11-12 baseline):

- `pnpm --filter @alfahd/types build` — passed before checks.
- `pnpm typecheck` and `pnpm lint` — passed; types lint is a repository no-op. After the final lookup fixture, `pnpm --filter fahd-dashboard typecheck` and `pnpm --filter fahd-dashboard lint` also passed.
- `pnpm --filter @alfahd/api exec vitest run src/common/interceptors/response.interceptor.spec.ts src/modules/inventory/inventory.service.spec.ts src/modules/inventory/inventory.controller.spec.ts src/modules/ip-management/ip.controller.spec.ts src/modules/routers/routers.controller.spec.ts` — 59 passed.
- `pnpm test` — 361 passed, 45 skipped; `pnpm --filter @alfahd/api test:e2e` — 189 passed. Expected failure-path logs were emitted. The 45 opt-in real-service tests were skipped.
- `pnpm build` — passed using the existing local dashboard environment. Build and API tests ran before the final fixture-only additions; workspace typecheck/lint were rerun afterward.
- Node JSON parsing check — 14 fenced JSON examples parsed; asserted inventory/movement and source/destination envelopes exist. Parsing and typechecking do not prove actual response equality.

These checks are partial regression evidence, not a live API/schema conformance test, human review, or staging acceptance. No secrets, database contents or real employee data were used as fixtures.
