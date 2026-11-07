# Phase 2 integration handoff — review draft

**Issue:** #67 (A2), part of #65. **Source baseline:** `7606270041d5e299f62ccd50bb8cabfaf2af0a4d` (master). **Status:** source-based draft, not a reviewed freeze or acceptance report. Revalidate against the merged head before implementation. The accountable owner is @Marwan-Mamdouh; review/handoff partner is @Hamadaae; UI contract review is required from @bahaashahin. No approval is implied by this document.

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
| GET /employees/:id | Detail | A or self | → `EmployeeDto` |
| PATCH /employees/:id | Update profile | A | `UpdateEmployeeRequestDto` → `EmployeeDto` |
| PATCH /employees/:id/status | Change status | A | `{status, reason}` → `EmployeeDto` |
| POST /employees/:id/photo | Upload | A | multipart `file` → 200 `{profilePhotoKey, url}` |
| POST /attendance/check-in | Check in | T | `{lat,lng}` → 201 `AttendanceRecordDto` |
| POST /attendance/check-out | Check out | T | → 200 `AttendanceRecordDto` |
| PATCH /attendance/:id | Override | A | `OverrideAttendanceRequestDto` → `AttendanceRecordDto` |
| GET /attendance/report | Enqueue report | A | `AttendanceQueryRequestDto` → 202 `{jobId}` |
| GET /warehouses, GET /warehouses/:id | List / detail | A, W, C | `QueryWarehousesDto` for list → `{items,total}` / warehouse |
| POST /warehouses, PATCH /warehouses/:id | Create / update | A | `CreateWarehouseDto` / `UpdateWarehouseDto` → warehouse |
| DELETE /warehouses/:id | Guarded deactivation | A | → 204; not a hard-delete UI promise |
| GET /products, GET /products/:id | List / detail | A, W, C, T | `QueryProductsDto` for list → `{items,total}` / product with stock |
| POST /products, PATCH /products/:id | Create / update | A, W | `CreateProductDto` / `UpdateProductDto` → product |
| DELETE /products/:id | Current guarded hard delete | A | → 204; **do not expose removal until #81 resolves semantics** |
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
| Attendance report | `from`, `to`, `department`, `employee_id` | job result, not a list |
| Warehouses | `search` | `limit` default 20, max 100; `offset` default 0; `{data:{items,total}}` |
| Products | `search`, `category`, `isLowStock` | same limit/offset envelope |
| Inventory | `warehouseId`, `productId` | same limit/offset envelope |
| Movements | `warehouseId`, `productId`, `movementType`, `technicianId` | same limit/offset envelope; inspect service for result DTO |
| Routers | `status`, `physicalCondition`, `warehouseId`, `productId`, `search` | `page` default 1; `limit` default 20, max 100; `{data:{items,total}}` |
| IP addresses | `status`, `isArchived`, `search` | same page/limit envelope |

Do not derive page count from `items.length`; use `total`. Router status, physical condition, physical location and custody are distinct facts. Existing-stock router registration (`isNewReceipt` omitted/false) is not a receipt; true is a new receipt. See `serialized-inventory-consistency.md` before wiring mutations. IP status is FREE/RESERVED; archival is separate. CSV format and limits are in `ip-csv-import.md`. Report storage and authenticated download limitations are in `local-report-storage.md`.

## Source-shaped examples (synthetic, illustrative)

The detailed request/response catalog with populated examples is [phase-2-wire-contracts.md](phase-2-wire-contracts.md). The typed UI proposal and fixtures are in `apps/web/src/phase2-handoff/`; they are independently typechecked but remain subject to human review.

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

Example request fragment: `POST /ip-addresses` with JSON `{ "address": "192.0.2.1", "notes": "synthetic example" }`; ADMIN only, 201 wraps the returned `IpAddressDto` in `data`. The wire catalog gives additional examples; review remains required.

## Proposed prop/callback seam — review required

The following is a proposed UI interface vocabulary, not an approved shared package or an API DTO. Backend containers adapt actual DTOs to UI view models; UI receives supplied state and invokes callbacks, never calls the API itself. Avoid using `apps/web/src/components/routers/types.ts` status aliases as backend statuses.

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

Concrete proposed interfaces and synthetic fixtures are provided in `apps/web/src/phase2-handoff/`. Empty results are distinct from errors and loading. These definitions are proposals, not evidence of agreement by the other owners; attendance reads and lookup selections represent approved direction, not existing APIs.

## Decision and acceptance gates

| Gate | Responsible owner / handoff | Required before |
| --- | --- | --- |
| Attendance reads: ADMIN list/history, date/employee/department/status filters and server filter-wide totals approved in user discussion 2026-11-08; no current read endpoint exists | @Marwan-Mamdouh with @bahaashahin; #69 | agree exact routes, fields, pagination bounds, timezone and totals before #69/#71; don't use speculative constants |
| People lookups: ADMIN/W minimal bounded ID/name/status/warehouse selections, no email/national ID, approved in user discussion 2026-11-08 | @Hamadaae with @Marwan-Mamdouh; #75 | agree routes, search limits and inactive/ON_LEAVE eligibility; server mutations revalidate targets |
| Photo display: authorized ADMIN/self retrieval and no UI-built provider URL approved in user discussion 2026-11-08 | @Marwan-Mamdouh with @bahaashahin; #73 | agree signed URL vs authenticated bytes, expiry, caching and unavailable-photo behavior; current employee reads contain only a storage key |
| Product deactivation, preserved references, exclusion from new selectors and historical visibility approved in user discussion 2026-11-08 | @Hamadaae with @Marwan-Mamdouh; #81 | agree API, safeguards for active stock/usage and historical selector behavior; source currently hard deletes; keep removal unavailable |
| Formal acceptance environment | @Marwan-Mamdouh; #89 | staging required by `PLAN.md`; identify staging or obtain explicit written waiver. User chose to retain the staging gate; **no waiver is approved**. Do not silently add deployment work |
| Reviewed per-action contract, examples/OpenAPI, concrete fixture types and cross-owner agreement | @Marwan-Mamdouh, @Hamadaae, @bahaashahin; #67 | marking A2 frozen or starting work that depends on it |

Current `apps/web/src/core/api/endpoints.ts` contains unverified or nonexistent endpoints (including `/ips` rather than `/ip-addresses`) and excluded domains; it is not a contract. `permissions.ts` currently grants IP reads to W/CS but not T; the API grants A/T. Fixes belong in the assigned integration tasks, not in this draft.

## Review and closure evidence

Before closing #67, owners must review the matrix, wire catalog, fixtures and outstanding technical gates, explicitly agree the cross-owner interfaces, and record reviewer decisions, merged PR/commit, environment and actual focused test commands/results. The user-approved directions above do not constitute approval by the other developers or approval of exact technical details. Existing A1 evidence in #66 is baseline evidence only. Do not close on an unmerged draft.

Verification on Windows, Node `24.22.2`, pnpm `12.6.0`, 2026-11-08, baseline `7606270` plus uncommitted handoff files:

- `pnpm --filter @alfahd/types build` — passed before checks.
- `pnpm typecheck` and `pnpm lint` — passed; types lint is a repository no-op. After the final lookup fixture, `pnpm --filter fahd-dashboard typecheck` and `pnpm --filter fahd-dashboard lint` also passed.
- `pnpm --filter @alfahd/api exec vitest run src/common/interceptors/response.interceptor.spec.ts src/modules/inventory/inventory.service.spec.ts src/modules/inventory/inventory.controller.spec.ts src/modules/ip-management/ip.controller.spec.ts src/modules/routers/routers.controller.spec.ts` — 59 passed.
- `pnpm test` — 361 passed, 45 skipped; `pnpm --filter @alfahd/api test:e2e` — 189 passed. Expected failure-path logs were emitted. The 45 opt-in real-service tests were skipped.
- `pnpm build` — passed using the existing local dashboard environment. Build and API tests ran before the final fixture-only additions; workspace typecheck/lint were rerun afterward.
- Node JSON parsing check — 14 fenced JSON examples parsed; asserted inventory/movement and source/destination envelopes exist. Parsing and typechecking do not prove actual response equality.

These checks are partial regression evidence, not a live API/schema conformance test, human review, or staging acceptance. No secrets, database contents or real employee data were used as fixtures.
