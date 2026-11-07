# Phase 2 wire catalog — source snapshot for review

Companion to [the handoff](phase-2-handoff.md), baseline `7606270`. This is an explicit example catalog, **not** an assertion that all contracts or permissions have been approved by reviewers. Paths are API paths; browser requests use `/api` and bearer credentials. The matrix in the handoff gives per-action roles and status codes. All names and identifiers below are synthetic. Object examples show actual selected fields; optional fields can be omitted only where the source DTO permits it. Source interfaces remain authoritative for complete domain objects. Dates in JSON are ISO strings.

Common IDs used below: employee `11111111-1111-4111-8111-111111111111`, warehouse `22222222-2222-4222-8222-222222222222`, product `33333333-3333-4333-8333-333333333333`, another warehouse `44444444-4444-4444-8444-444444444444`. `id` path parameters are UUIDs unless referring to jobs. All successful object responses are wrapped once in `data`, except employee list's existing `{data,meta}`; 204 has no body. Error shape and permissions are in the handoff. Invalid DTO/UUID yields 400; missing resources 404; unauthorized 401/403; duplicates and certain state conflicts 409. Some state validation uses 400, so clients must not assume all business conflicts are 409.

## Employees (implemented)

`POST /employees` accepts `{name,email,role,department?,phone?,nationalId?,hireDate?,assignedWarehouseId?}`. Role is one of `ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECHNICIAN`; department is `TECHNICAL`, `CUSTOMER_SERVICE`, `WAREHOUSE`, `MANAGEMENT`; name max 255, phone/nationalId max 30, hireDate date string, assignedWarehouseId UUID. Technician warehouse constraints are enforced by service. Creation response is an employee object, not a temporary password. `PATCH /employees/:id` accepts only `{name?,department?,phone?,assignedWarehouseId?}`. `PATCH /employees/:id/status` requires `{status,reason}` where status is `ACTIVE`, `ON_LEAVE`, or `INACTIVE` and reason is nonblank. `POST /employees/:id/photo` accepts multipart `file` (JPEG/PNG magic bytes, max 5 MiB), returns `{data:{profilePhotoKey,url}}`; the key is not itself an approved URL.

Example list request `GET /employees?page=1&pageSize=20&role=TECHNICIAN` and 200 response:

```json
{"data":[{"id":"11111111-1111-4111-8111-111111111111","name":"Example Employee","email":"employee@example.invalid","role":"TECHNICIAN","department":"TECHNICAL","phone":null,"nationalId":null,"hireDate":null,"status":"ACTIVE","assignedWarehouseId":"22222222-2222-4222-8222-222222222222","profilePhotoKey":null,"createdAt":"2026-11-08T09:00:00.000Z","updatedAt":"2026-11-08T09:00:00.000Z"}],"meta":{"page":1,"pageSize":20,"total":1}}
```

Detail, create and update wrap one such employee under `data`. Example create body: `{"name":"Example Employee","email":"employee@example.invalid","role":"TECHNICIAN","department":"TECHNICAL","assignedWarehouseId":"22222222-2222-4222-8222-222222222222"}`. Status body: `{"status":"ON_LEAVE","reason":"Scheduled leave"}`.

## Attendance (implemented actions; read proposal separate)

`POST /attendance/check-in` requires numeric `{lat,lng}` in valid latitude/longitude ranges; check-out requires no body. `PATCH /attendance/:id` accepts `{checkInAt?,checkOutAt?,status?,overrideReason}` with ISO date strings, status `ON_TIME` or `LATE`, and nonempty `overrideReason`. `GET /attendance/report` accepts optional `from`, `to`, `department`, `employee_id`; it enqueues a job, not a list. Check-in may fail 400 for geofence/invalid conditions and conflict for duplicate attendance; exact machine code is not universal.

Representative check-in response; checkout and override return additional fields, and the current operations do not return `userId`:

```json
{"data":{"id":"55555555-5555-4555-8555-555555555555","workDate":"2026-11-08","checkInAt":"2026-11-08T09:00:00.000Z","checkInDistanceM":10,"status":"ON_TIME"}}
```

ADMIN list/history and filter-wide totals are **approved direction, not implemented API**; route names, exact response/aggregate fields, limits, date boundary/timezone and eligibility are owned gates in the handoff. The UI proposal's `AttendanceTotals` is not a frozen wire DTO; no synthetic ABSENT records.

## Warehouses (implemented)

Create accepts `name`, `address`, `latitude` (-90..90), `longitude` (-180..180), optional `geofenceRadiusMeters` (50..2000, default 150) and `managerId` UUID. Patch accepts optional versions of those fields. Example create: `{"name":"Example warehouse","address":"Example street","latitude":30.0,"longitude":31.0}`. List has `search`, `limit`, `offset`; detail and writes return a warehouse object:

```json
{"data":{"id":"22222222-2222-4222-8222-222222222222","name":"Example warehouse","address":"Example street","latitude":30,"longitude":31,"geofenceRadiusMeters":150,"managerId":null,"isActive":true,"createdAt":"2026-11-08T09:00:00.000Z","updatedAt":"2026-11-08T09:00:00.000Z"}}
```

`DELETE /warehouses/:id` deactivates under guards and returns 204; attached stock/staff/router safeguards can yield 409. Warehouse API properties are `latitude`/`longitude`, not database `gpsLat`/`gpsLng`.

## Products and inventory (implemented)

`POST /products` requires nonempty `name`, `sku`, `model`, `category`, optional `description`, nonnegative integer `lowStockThreshold` (default 10). `PATCH /products/:id` accepts the same fields optionally. SKU is normalized to uppercase and duplicate SKU yields 409. List `GET /products?limit=20&offset=0` yields:

```json
{"data":{"items":[{"id":"33333333-3333-4333-8333-333333333333","name":"Example cable","sku":"EX-CABLE","model":"EX-1","category":"ACCESSORY","description":null,"lowStockThreshold":10,"isSerialized":false,"createdAt":"2026-11-08T09:00:00.000Z","updatedAt":"2026-11-08T09:00:00.000Z","totalStock":12,"isLowStock":false}],"total":1}}
```

Detail returns the same product-with-stock shape; create/update return the base product without `totalStock`/`isLowStock`. Current ADMIN `DELETE /products/:id` is a guarded **hard delete**, not the approved future deactivation; don't expose it in Phase 2. Exact future status/filter/stock safeguards remain #81 gates.

Inventory requests, all with UUID IDs and positive integer quantities unless stated:

| Action | JSON body, excluding optional `notes` and optional `responsibleUserId` |
| --- | --- |
| inbound | `{warehouseId,productId,quantity,supplierName}`; supplier name nonempty, max 255 |
| outbound / returns | `{warehouseId,productId,quantity,technicianId}` |
| transfer | `{fromWarehouseId,toWarehouseId,productId,quantity}`; warehouses must differ |
| adjust | `{warehouseId,productId,newQuantity,notes}`; `newQuantity` integer ≥0, `notes` nonempty after trimming |

Controllers use the authenticated user as responsible actor when present; clients must not use `responsibleUserId` to impersonate another actor. Quantity-only operations reject serialized SKUs; insufficient stock or inactive warehouse can yield 400. List results contain inventory fields plus nested product and warehouse summaries; movement list contains stock movement objects; both use `{data:{items,total}}` and limit/offset.

Example inbound request:

```json
{"warehouseId":"22222222-2222-4222-8222-222222222222","productId":"33333333-3333-4333-8333-333333333333","quantity":2,"supplierName":"Example supplier"}
```

201 response, with all persisted inventory/movement fields:

```json
{"data":{"inventory":{"id":"66666666-6666-4666-8666-666666666666","warehouseId":"22222222-2222-4222-8222-222222222222","productId":"33333333-3333-4333-8333-333333333333","quantity":12,"updatedAt":"2026-11-08T09:00:00.000Z"},"movement":{"id":"77777777-7777-4777-8777-777777777777","warehouseId":"22222222-2222-4222-8222-222222222222","productId":"33333333-3333-4333-8333-333333333333","movementType":"INBOUND_SUPPLIER","quantity":2,"supplierName":"Example supplier","technicianId":null,"responsibleUserId":"11111111-1111-4111-8111-111111111111","notes":null,"createdAt":"2026-11-08T09:00:00.000Z"}}}
```

Outbound and returns return the same envelope with their actual movement type; adjustment returns it with `ADJUSTMENT`. Transfer returns **only** the two inventory objects, not movement objects:

```json
{"data":{"sourceInventory":{"id":"66666666-6666-4666-8666-666666666666","warehouseId":"22222222-2222-4222-8222-222222222222","productId":"33333333-3333-4333-8333-333333333333","quantity":10,"updatedAt":"2026-11-08T09:00:00.000Z"},"destInventory":{"id":"88888888-8888-4888-8888-888888888888","warehouseId":"44444444-4444-4444-8444-444444444444","productId":"33333333-3333-4333-8333-333333333333","quantity":2,"updatedAt":"2026-11-08T09:00:00.000Z"}}}
```

## Routers (implemented)

Create: `{serialNumber,productId,warehouseId,physicalCondition?,isNewReceipt?,notes?}`; serial max 100 and UUIDs required. Assign: `{technicianId,notes?}`. Transition: `{status,reason,targetWarehouseId?,notes?}` with nonblank reason; condition: `{physicalCondition,reason,warehouseId?,externalLocation?}`. Export body `{warehouseId?}`. Invalid transitions return 400, unusable assignment 409, duplicate serial 409. See [router-transition.md](router-transition.md), [serialized-inventory-consistency.md](serialized-inventory-consistency.md) and `packages/types` for domain values and invariants.

Example list payload (`GET /routers?page=1&limit=20`):

```json
{"data":{"items":[{"id":"99999999-9999-4999-8999-999999999999","serialNumber":"EX-ROUTER-001","productId":"33333333-3333-4333-8333-333333333333","status":"AVAILABLE","physicalCondition":"SERVICEABLE","warehouseId":"22222222-2222-4222-8222-222222222222","externalLocation":null,"currentHolderType":"WAREHOUSE","currentHolderId":"22222222-2222-4222-8222-222222222222","notes":null,"createdAt":"2026-11-08T09:00:00.000Z","updatedAt":"2026-11-08T09:00:00.000Z"}],"total":1}}
```

Detail/create/assignment/transition/condition wrap one `RouterDto` under `data`. Assignment, condition-history and status-history endpoints return arrays of `RouterAssignmentDto`, `RouterConditionHistoryDto` and `RouterStatusHistoryDto`, respectively, under `data`; their exact fields are shared types. Export returns a job ID, not a file.

## IPv4 and jobs (implemented)

Create requires valid individual IPv4 `address` and optional string `notes`; patch accepts optional `notes`. Reserve/release/archive/unarchive accept optional `reason`; archive requires FREE. List filters and permissions are in the handoff. No ticket allocation route exists.

```json
{"data":{"items":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","address":"192.0.2.1","status":"FREE","isArchived":false,"customerId":null,"notes":"Example","createdAt":"2026-11-08T09:00:00.000Z","updatedAt":"2026-11-08T09:00:00.000Z"}],"total":1}}
```

Detail and mutations wrap one `IpAddressDto`; history wraps an array of `IpHistoryDto`. `POST /ip-addresses/import` is ADMIN multipart `file`, 5 MiB max; see [CSV contract](ip-csv-import.md) for accepted headers, row limits and outcomes. Report and import enqueue return `{"data":{"jobId":"example-job"}}`. Polling example:

```json
{"data":{"id":"example-job","status":"COMPLETED","downloadUrl":null,"error":null,"inserted":1,"skipped":0,"errors":[],"result":{"total":1,"inserted":1,"skipped":0,"errors":[]}}}
```

Report jobs may provide a direct storage URL or an authenticated local `/jobs/:id/download` path. Polling and local downloads are requester-or-ADMIN; unauthorized job IDs return 404. For local files use authenticated `/api/jobs/:id/download`, returning XLSX bytes, not a JSON envelope. Failed jobs expose a generic client error, not raw worker internals.

## Ownership and safety gates

Single writers for the proposed shared `apps/web/src/phase2-handoff/` contracts: @Marwan-Mamdouh for HR and shared interfaces, @Hamadaae for supply and network adapters; changes affecting the common file require coordination with @bahaashahin before edits. @bahaashahin owns presentational components/forms. Backend owners own page containers and network/polling/cache code, including API adapters translating DTOs and offset/page differences into view models. Concrete shared-file changes require one agreed writer per change and cross-owner review, not simultaneous edits.

User approved the four **directions** recorded in the handoff on 2026-11-08. Detailed technical choices and review by named developers remain open; none authorizes implementing #69/#75/#73/#81 here. Formal acceptance still requires staging; #89 owns execution and @Marwan-Mamdouh owns identifying the environment or obtaining a written waiver. No waiver exists.
