# Phase 2 proposed contracts — review required

**Status:** proposals for #67, not implemented endpoints or approved OpenAPI. Baseline `97bcd31`; related work belongs to #69, #75, #73 and #81. The user confirmed the business directions in the [review agenda](phase-2-review-agenda.md); proposed route names, field names, status codes and technical policies below require named owners' agreement. Do not wire production clients to these proposals before review and implementation.

Existing routes, envelopes and errors are documented in the [wire catalog](phase-2-wire-contracts.md). JSON examples here are synthetic. Proposed errors use the existing global filter envelope; error messages and any machine codes shown are proposals, not existing guarantees. All routes require bearer authentication. Validation errors return the standard 400 envelope, missing/invalid authentication 401, and disallowed roles 403 unless noted.

## 1. Attendance list and employee history (#69)

**Proposed:** `GET /attendance` — ADMIN only. User confirmed the employee page should show that employee's own attendance history, independently of department; the overall ADMIN attendance list retains its current-department filter. One list contract can supply the employee page via `employee_id` with no department filter; a separate history endpoint is not proposed. The current API has no attendance list/read endpoint. Existing report `GET /attendance/report` remains a separate asynchronous job and does not gain these filters automatically.

| Query | Proposed validation / semantics |
| --- | --- |
| `from`, `to` | Optional `YYYY-MM-DD` local work dates, inclusive; reject invalid dates or `from > to`. Stored `workDate` uses `APP_TIMEZONE` (default `Africa/Cairo`); dates are not UTC timestamp boundaries. |
| `employee_id` | Optional UUID v4, consistent with existing report query spelling. |
| `department` | Optional `TECHNICAL`, `CUSTOMER_SERVICE`, `WAREHOUSE` or `MANAGEMENT`; user confirmed filtering by the employee's **current** department, not a historical snapshot. |
| `status` | Optional `ON_TIME` or `LATE`; no generated absence rows. |
| `page`, `pageSize` | Positive integers; defaults 1 and 20; pageSize maximum 100. User confirmed newest work date first; proposed tie-breaker is `id` descending for stable ordering. |

Proposed 200 response for `GET /attendance?from=2026-11-01&to=2026-11-30&page=1&pageSize=20`:

```json
{"data":{"items":[{"id":"55555555-5555-4555-8555-555555555555","userId":"11111111-1111-4111-8111-111111111111","employeeName":"Example Employee","department":"TECHNICAL","workDate":"2026-11-08","checkInAt":"2026-11-08T07:00:00.000Z","checkOutAt":null,"checkInDistanceM":10,"hoursWorked":null,"status":"ON_TIME","overrideReason":null,"overriddenBy":null,"overriddenAt":null}],"page":1,"pageSize":20,"filteredTotal":1,"totals":{"total":1,"onTime":1,"late":0}}}
```

User-confirmed totals count stored records matching date, employee and department filters **before applying the status filter or pagination**; `total = onTime + late`. Thus selecting LATE can produce an empty `items` array while totals still count ON_TIME records. With no records matching the non-status filters, totals are zero. Empty pages beyond the last page retain the same contextual totals. The response also needs a status-filtered count for pagination; the exact field and response shape remain proposed below for review. Department filtering uses the employee's current department as confirmed by the user; displaying current employee name and department is proposed, not historical snapshots, and nullable department is allowed. Check-in/out times are ISO UTC instants; `workDate` is the stored date. No coordinates are proposed for this list. Items, filtered count and totals must reflect the same query snapshot. Display name semantics, tie-breaker, response shape and optional filters require HR/UI review.

**Proposed response addition:** `filteredTotal` alongside `items`, `page`, `pageSize` and `totals`, counting all records after **all** filters including status but before pagination. For 80 on-time and 20 late records, filtering LATE yields `filteredTotal: 20` and `totals: {total: 100, onTime: 80, late: 20}`. With no status filter, `filteredTotal` equals `totals.total`. This separates the pagination count from contextual totals; the field name and placement remain for review.

Proposed 200 for `GET /attendance?employee_id=11111111-1111-4111-8111-111111111111&status=LATE&page=1&pageSize=20` when the employee has one on-time record and no late records:

```json
{"data":{"items":[],"page":1,"pageSize":20,"filteredTotal":0,"totals":{"total":1,"onTime":1,"late":0}}}
```

The employee page supplies `employee_id` and does not add a department filter. The adapter maps `filteredTotal` to UI `AttendancePage.page.total` and retains `totals`, even for an empty list; the UI filter's `employeeId` maps to wire `employee_id`. This mapping is proposed, not implemented.

## 2. Minimal eligible people lookups (#75)

**Proposed:** `GET /employee-lookups` — purpose-specific authorization: ADMIN and WAREHOUSE_STAFF can request technician choices; only ADMIN can request warehouse-manager choices, as confirmed by the user. This is a minimal selector, not access to `/employees`; it returns no email, national ID, phone or photo key. It is for new selections, not historical label resolution. Requests for a purpose not permitted to the caller return 403.

| Query | Proposed validation / semantics |
| --- | --- |
| `purpose` | Required: `technician` for router assignment and technician stock movements; `warehouse-manager` for warehouse manager selection. User confirmed ACTIVE `TECHNICIAN` employees for technician choices and ACTIVE `WAREHOUSE_STAFF` or `ADMIN` employees for manager choices. |
| `q` | Optional trimmed name search, 1–100 characters when supplied. Omitted query supports an initial bounded list. |
| `warehouseId` | Optional UUID v4 filter on assigned warehouse; no implied authorization or additional assignment constraint. |
| `limit`, `offset` | Default 20 and 0; limit 1–100, offset nonnegative; stable sort by name then ID. |

Proposed 200 response for `GET /employee-lookups?purpose=technician&limit=20&offset=0`:

```json
{"data":{"items":[{"id":"11111111-1111-4111-8111-111111111111","name":"Example Employee","status":"ACTIVE","warehouseId":"22222222-2222-4222-8222-222222222222"}],"total":1}}
```

All new-choice results must be ACTIVE. User confirmed cross-warehouse technician assignment is allowed: show the technician's assigned warehouse (nullable), but do not require it to match the stock/router warehouse. Server mutations revalidate existence, status and role atomically with the operation; stale choices cannot bypass the rule. Existing current mutation services may not yet enforce this contract. A lookup result is not permission to perform a mutation: warehouse create/update remains ADMIN-only. User confirmed authorized history/detail responses should supply names for historical references, including inactive employees; do not relax the new-choice selector to resolve them. Define missing/deleted-reference behavior and the exact historical response fields before implementation.

Proposed authorization examples: ADMIN may request either purpose; WAREHOUSE_STAFF may request `technician` but not `warehouse-manager`; CS and TECHNICIAN may request neither. A denied WAREHOUSE_STAFF request for `GET /employee-lookups?purpose=warehouse-manager` would return 403 in the existing exception-filter envelope, for example:

```json
{"statusCode":403,"message":"Insufficient role","error":{"code":"ERROR","message":"Insufficient role"},"path":"/employee-lookups?purpose=warehouse-manager","timestamp":"2026-11-13T00:00:00.000Z"}
```

The text is illustrative, not a stable error code. Return at most the specified minimal fields even for ADMIN; a `warehouseId` value of `null` means unassigned. Search, limits and authorization must be server-enforced, not only UI filtering.

## 3. Public employee photo delivery (#73)

**User-approved direction:** photos may be publicly viewed and shared by anyone with their URL, including unauthenticated people. This supersedes the earlier ADMIN/self-only authenticated-bytes proposal. Employee detail/list access is not made public; upload/replacement remains ADMIN-only. An authorized employee response supplies a nullable photo identifier; the frontend constructs Cloudinary URLs and selects responsive transformations. No provider secret belongs in the browser. Verify whether `EmployeeDto.profilePhotoKey` is suitable and agree public configuration before freezing the contract.

No photo or an unavailable image shows a neutral placeholder; admins can retry a temporarily unavailable photo. An expired app session remains an authentication problem. Cloudinary delivery need not carry app credentials. Owners must agree identifier format, responsive transformations and fallback/retry; employee API roles do not change.

**Delivery and cache gate:** The user reports existing assets are private and accepts public access; provider settings and asset compatibility remain unverified. Current upload stores the provider public ID and attempts to delete the old asset; deletion failures are logged. Verify public delivery and whether replacement always yields a new ID before relying on it for cache busting; otherwise agree a versioned URL. Old URLs or cached copies may remain accessible. No provider settings or assets have been changed; review any migration first.

Existing employee DTO fragment (not a complete response):

```json
{"id":"11111111-1111-4111-8111-111111111111","profilePhotoKey":"employees/photos/synthetic-photo"}
```

The current mapper returns `profilePhotoKey`, and the current upload response supplies `{profilePhotoKey,url}`. Proposed UI adaptation maps the identifier to `EmployeeRow.photoId`; it does not add a `photoId` field to the existing wire DTO. The frontend's URL builder, Cloudinary cloud name and transformation choices are not specified or implemented by this example. Avoid placing any API secret in public configuration.

## 4. Product deactivation (#81)

**Proposed:** `POST /products/:id/deactivate` — ADMIN only, empty request body, returning 200 with a product representation including `isActive: false` under `data`. The exact full response schema is to be based on the implemented product DTO and agreed before publishing OpenAPI. Existing `DELETE /products/:id` performs a guarded hard delete; do not call or represent it as deactivation.

Illustrative response fragment (not a complete product DTO):

```json
{"data":{"id":"33333333-3333-4333-8333-333333333333","sku":"EX-CABLE","isActive":false}}
```

User-confirmed behavior: reject deactivation if any warehouse has positive stock or **any linked router has a status other than `DECOMMISSIONED`**. This includes `LOST`; it blocks until an agreed resolution exists, not an implied transition. Explain the blockers, including stock quantity and/or non-decommissioned router count as applicable, without partially deactivating. Otherwise atomically mark inactive, preserving product ID, SKU, references and history. Repeating deactivation for an already-inactive product succeeds and returns its existing inactive representation, without another deactivation or duplicate history. ADMIN may reactivate the original product; reserve its SKU while inactive rather than permit another product to reuse it. Exclude inactive products from new-selection flows while keeping authorized detail/history visible. Mutations creating stock or router usage must also reject inactive products; checks and updates require a transaction/concurrency strategy that prevents races. Proposed errors: 409 for blocking stock/router usage, standard 404 for missing product; structured blocker fields and error code require review. Reactivation retry semantics, exact reactivation API, inactive detail/list filters and transaction design still require review. Coordinate with the M2b inventory invariants and #81 before implementation.

Illustrative **proposed**, not currently emitted, 409 response for a product blocked by both stock and routers:

```json
{"statusCode":409,"message":"Product cannot be deactivated while stock or active routers remain","error":{"code":"PRODUCT_DEACTIVATION_BLOCKED","message":"Product cannot be deactivated while stock or active routers remain","details":{"positiveStockQuantity":3,"nonDecommissionedRouterCount":2}},"path":"/products/33333333-3333-4333-8333-333333333333/deactivate","timestamp":"2026-11-13T00:00:00.000Z"}
```

Both counts are nonnegative; the first is the sum of positive warehouse balances and the second counts linked router assets whose status is not `DECOMMISSIONED`. They are **separate blockers**, not quantities to add together: serialized router stock can overlap. The error code/field names, whether to provide warehouse breakdowns, and disclosure policy require supply review. The global exception filter supports `code` and `details`, but the proposed endpoint must explicitly produce them.

## Review and implementation test checklist

- [ ] HR/UI: approve date validation, current display name, route/envelope, tie-breaker, proposed filtered pagination count and report differences; current-department filtering and contextual totals are user-confirmed.
- [ ] Supply: review lookup purposes, confirmed manager roles, cross-warehouse rules, historical-label response fields and mutation revalidation.
- [ ] HR/storage/UI: verify public delivery, existing asset compatibility, identifier/replacement behavior, responsive transformations, caching and fallback/retry.
- [ ] Supply: review confirmed router-status and SKU rules, define exact deactivation/reactivation APIs and affected selectors/mutations; verify concurrency safeguards.
- [ ] For each implemented endpoint, add DTO/controller/service and authorization tests, empty/invalid/conflict cases and response-envelope tests. For attendance test timezone/DST boundaries, contextual totals independent of status/pagination, status-filtered pagination count and empty filtered pages; for lookups test PII exclusion and stale eligibility; for photos test ADMIN-only upload, identifier replacement, URL construction and fallback, plus real provider delivery; for product deactivation test historical visibility and concurrent stock/router creation.
