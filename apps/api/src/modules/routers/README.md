# 📡 RoutersModule (Serialized Hardware Asset & Custody Tracking)

**Path:** `apps/api/src/modules/routers`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** Milestone M2b Complete (100% Type-Safe, Pure Drizzle ORM, Vitest Unit + E2E Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.6, Milestone M2b Specification**, and [`docs/contracts/m2b-supply-implementation.md`](file:///E:/alfahd-ems/docs/contracts/m2b-supply-implementation.md):
* **Serialized Asset Lifecycle:** Tracks every individual router hardware asset by unique `serialNumber` through its entire operational journey.
* **Separation of Status vs Physical Condition:**
  * **Lifecycle Status:** `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, `DECOMMISSIONED`.
  * **Physical Condition:** `SERVICEABLE`, `DAMAGED`, `DEFECTIVE`.
  * *Invariant:* Physical condition is independent of custody status. If an `AVAILABLE` warehouse unit is dropped and damaged, its physical condition becomes `DAMAGED` while its lifecycle status remains `AVAILABLE` until scheduled for repair or decommissioning.
* **Custody Tracking & Active Assignment Invariant:**
  * Tracks holder type (`WAREHOUSE`, `TECHNICIAN`, `CUSTOMER`), holder ID, and custody interval.
  * Enforces exactly **one** active custody record per router at any given time via a PostgreSQL partial unique index: `CREATE UNIQUE INDEX idx_router_active_assignment ON router_assignments (router_id) WHERE released_at IS NULL`.
* **Stock Delta Synchronization:**
  * When receiving new stock (`isNewReceipt: true`), the warehouse consumable inventory is atomically incremented (+1 `INBOUND_SUPPLIER`).
  * When assigned to a technician, warehouse stock is decremented (-1 `OUTBOUND_TECHNICIAN`).
  * When a warehouse unit suffers physical damage, warehouse stock is decremented (-1 `ADJUSTMENT`) while retaining the router asset record.
* **Async Inventory Reports:** Administrators can trigger asynchronous Excel workbook exports of router asset inventories, processed through BullMQ on the `reports` queue with ExcelJS.

---

## 2. Architecture & The LMS 5-Layer Pattern

```
┌──────────────────────────────────────────────────────────┐
│                   RoutersController                      │
│  - REST HTTP endpoints (/routers/*)                      │
│  - RolesGuard RBAC (ADMIN, WAREHOUSE_STAFF, TECH, CS)    │
│  - Swagger OpenAPI documentation                         │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                     RoutersService                       │
│  - Whitelist state machine transitions                   │
│  - Custody handoffs & inventory stock delta sync         │
│  - Injects ONLY RepositoryService + BullMQ Queue         │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects single facade:
                             ▼
┌──────────────────────────────────────────────────────────┐
│               RepositoryService (Facade)                 │
│  - Centralized injection facade: this.repo.routers       │
│  - Atomic transactions: this.repo.transaction(tx => ...) │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates calls to:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   RoutersRepository                      │
│  - Drizzle ORM operations on routers & assignments       │
│  - Pagination, multi-field search, custody queries       │
└────────────────────────────┬─────────────────────────────┘
                             │ Extends:
                             ▼
┌──────────────────────────────────────────────────────────┐
│  BaseRepository<Router, NewRouter, typeof routers>       │
│  - Generic CRUD: findAll, findById, create, deleteById   │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                @Inject(DRIZZLE) db                       │
│  - NodePgDatabase<typeof schema> (PostgreSQL Pool)       │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Database Layer (`routers.repository.ts`)

### A. Schemas & Tables (`src/database/schema/index.ts`)
* **`routers`**:
  * `id`: UUID primary key
  * `serialNumber`: VARCHAR(100), unique, indexed
  * `productId`: UUID foreign key referencing `products.id`
  * `status`: `router_status` enum (`AVAILABLE`, etc.)
  * `physicalCondition`: `router_physical_condition` enum (`SERVICEABLE`, `DAMAGED`, `DEFECTIVE`)
  * `warehouseId`: UUID foreign key referencing `warehouses.id` (null if in technician custody)
  * `externalLocation`: VARCHAR(255) for third-party repair shops
  * `notes`: TEXT
* **`router_assignments`**:
  * `id`: UUID primary key
  * `routerId`: UUID foreign key referencing `routers.id`
  * `holderType`: `router_holder_type` enum (`WAREHOUSE`, `TECHNICIAN`, `CUSTOMER`)
  * `warehouseId` / `technicianId`: nullable UUID holders
  * `assignedAt`: Timestamp, defaults to now
  * `releasedAt`: Timestamp, null while assignment is active
  * `assignedBy`: UUID foreign key referencing `users.id`
  * Partial unique index: `(router_id) WHERE released_at IS NULL`
* **`router_condition_history`**:
  * `id`: UUID primary key
  * `routerId`: UUID foreign key
  * `fromCondition` / `toCondition`: condition enums
  * `fromWarehouseId` / `toWarehouseId` / `externalLocation`: location movement context
  * `reason`: TEXT, mandatory explanation
  * `changedBy`: UUID actor

### B. `RoutersRepository` Methods
* `findBySerialNumber(serialNumber, tx?)`: Fast indexed lookup by trimmed serial number.
* `findManyWithPagination(params)`: Filters by status, condition, warehouse, product, serial search with pagination.
* `createRouter(data, tx?)` / `updateRouter(id, updates, tx?)`: Entity creation and updates.
* `createAssignment(data, tx?)`: Creates a new custody interval.
* `findActiveAssignment(routerId, tx?)`: Returns the unique active custody record (`releasedAt IS NULL`).
* `releaseActiveAssignment(routerId, releasedAt, tx?)`: Sets `releasedAt` on the current active assignment.
* `findAssignmentsByRouter(routerId)`: Full historical custody trail.
* `createConditionHistory(data, tx?)` / `findConditionHistory(routerId)`: Audit log of hardware condition transitions.
* `getWarehouseRouterCounts(warehouseId)`: Status/condition counts for warehouse deactivation guards and reports.

---

## 4. Service Layer (`routers.service.ts`)

Orchestrates business logic and transactional integrity:

* **`create(dto: CreateRouterDto, userId)`**:
  * Validates warehouse existence and active status (rejects deactivated hubs).
  * Validates catalog product existence.
  * Verifies unique `serialNumber` (throws `ConflictException` 409).
  * Opens initial warehouse custody assignment if condition is `SERVICEABLE`.
  * If `isNewReceipt: true`, atomically increments warehouse inventory (+1 `INBOUND_SUPPLIER`).
* **`assign(id, dto: AssignRouterDto, userId)`**:
  * Guard: Router must be `AVAILABLE`, `SERVICEABLE`, and located in a warehouse.
  * Releases previous warehouse custody and opens new `TECHNICIAN` custody record.
  * Sets status to `ASSIGNED_TO_TECHNICIAN`.
  * Decrements warehouse stock (-1 `OUTBOUND_TECHNICIAN`).
* **`transition(id, dto: TransitionRouterDto, userId)`**:
  * Validates transition against `ALLOWED_ROUTER_TRANSITIONS` whitelist:
    * `AVAILABLE` $\rightarrow$ `ASSIGNED_TO_TECHNICIAN` (via assign endpoint).
    * `ASSIGNED_TO_TECHNICIAN` $\rightarrow$ `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `LOST`.
    * `RETURNED` $\rightarrow$ `AVAILABLE`, `UNDER_REPAIR`, `DAMAGED`.
    * `DAMAGED` $\rightarrow$ `UNDER_REPAIR`, `DECOMMISSIONED`.
    * `UNDER_REPAIR` $\rightarrow$ `AVAILABLE`, `DECOMMISSIONED`.
    * Terminal states (`LOST`, `DECOMMISSIONED`): no transitions permitted.
* **`updateCondition(id, dto: UpdateRouterConditionDto, userId)`**:
  * Records audit trail in `router_condition_history`.
  * If warehouse damage occurs to an `AVAILABLE` unit: keeps status `AVAILABLE`, releases active custody (empty custody), and decrements usable stock (-1 `ADJUSTMENT`).
* **`exportRouterReport(query, userId)`**:
  * Dispatches `ROUTER_INVENTORY_REPORT` background job to BullMQ `reports` queue.

---

## 5. Controller Layer & API Reference (`routers.controller.ts`)

All routes dynamically consume the centralized route constants manifest (`src/common/constants/routes.constants.ts`):
* Controller: `@Controller(routes.routers.root)`
* Routes: `@Post(routes.routers.export)`, `@Get(routes.routers.id)`, `@Post(routes.routers.assign)`, `@Patch(routes.routers.transition)`, `@Patch(routes.routers.condition)`, `@Get(routes.routers.assignments)`, `@Get(routes.routers.conditionHistory)`

Base Route: `/routers`  
Guards: `JwtAuthGuard`, `RolesGuard`

| HTTP Method | Route | Description | Allowed Roles | Request Body / Query | Success Response | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/routers` | Register / receive physical router | `ADMIN`, `WAREHOUSE_STAFF` | `CreateRouterDto` | `201 Created` (`RouterDto`) | `400`, `409` |
| `GET` | `/routers` | List routers with pagination & filters | `ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECH` | `RouterQueryDto` | `200 OK` (`{ items, total }`) | `400` |
| `GET` | `/routers/:id` | Get router details & active custody | `ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECH` | None | `200 OK` (`RouterDto`) | `400`, `404` |
| `POST` | `/routers/:id/assign` | Hand custody over to technician | `ADMIN`, `WAREHOUSE_STAFF` | `AssignRouterDto` | `200 OK` (`RouterDto`) | `400`, `404`, `409` |
| `PATCH` | `/routers/:id/transition` | Transition lifecycle state machine | `ADMIN`, `WAREHOUSE_STAFF` | `TransitionRouterDto` | `200 OK` (`RouterDto`) | `400`, `404` |
| `PATCH` | `/routers/:id/condition` | Update physical condition & audit | `ADMIN`, `WAREHOUSE_STAFF` | `UpdateRouterConditionDto` | `200 OK` (`RouterDto`) | `400`, `404` |
| `GET` | `/routers/:id/assignments` | Full custody assignment history | `ADMIN`, `WAREHOUSE_STAFF` | None | `200 OK` (`RouterAssignmentDto[]`) | `400`, `404` |
| `GET` | `/routers/:id/condition-history` | Condition change audit history | `ADMIN`, `WAREHOUSE_STAFF` | None | `200 OK` (`RouterConditionHistoryDto[]`) | `400`, `404` |
| `POST` | `/routers/export` | Enqueue async Excel report job | `ADMIN` | `RouterReportQueryDto` | `200 OK` (`{ jobId }`) | `400`, `403` |

---

## 6. Testing & Quality Assurance

* **Unit Tests**:
  * [`routers.service.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/routers/routers.service.spec.ts) (11 tests): Verifies receipt stock deltas, assignment custody, whitelist state transitions, warehouse damage adjustment, and BullMQ export job enqueueing.
  * [`routers.controller.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/routers/routers.controller.spec.ts) (10 tests): Verifies HTTP delegation and DTO validation.

* **Integration & E2E Test Suite**:
  * [`test/routers.e2e-spec.ts`](file:///e:/alfahd-ems/apps/api/test/routers.e2e-spec.ts) (**20 test cases** across 6 testing suites):
  
  #### Suite 1: Authentication & RBAC (7 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `200 OK` — Allows `TECHNICIAN` to query and read paginated router lists.
  3. `200 OK` — Allows `CS` (Customer Support) to read single router details by ID.
  4. `403 Forbidden` — Blocks `CS` from registering new physical routers.
  5. `403 Forbidden` — Blocks `TECHNICIAN` from registering new physical routers.
  6. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from dispatching router inventory Excel exports.
  7. `200 OK` — Allows `ADMIN` to trigger async router inventory Excel exports with `{ jobId }`.

  #### Suite 2: Router Registration / Inbound (4 tests)
  8. `201 Created` — Allows `WAREHOUSE_STAFF` to register a valid router asset.
  9. `409 Conflict` — Rejects router registration when `serialNumber` already exists in database.
  10. `400 Bad Request` — Blocks registration when target warehouse is soft-deactivated (`isActive: false`).
  11. `400 Bad Request` — Blocks registration when mandatory `serialNumber` is omitted.

  #### Suite 3: Custody Assignment & Handoff (3 tests)
  12. `200 OK` — Assigns an `AVAILABLE` router to a technician, sets status to `ASSIGNED_TO_TECHNICIAN`, and records custody interval.
  13. `409 Conflict` — Blocks assignment when router already has an active open assignment (`releasedAt IS NULL`).
  14. `200 OK` — Retrieves chronological custody assignment history for an individual router.

  #### Suite 4: Lifecycle State Machine Transitions (2 tests)
  15. `200 OK` — Transitions router status along the approved transition whitelist (`ASSIGNED_TO_TECHNICIAN` $\to$ `RETURNED`).
  16. `400 Bad Request` — Rejects illegal lifecycle transitions (`RETURNED` $\to$ `INSTALLED_AT_CUSTOMER`) not defined in the contract whitelist.

  #### Suite 5: Physical Condition & Audit History (2 tests)
  17. `200 OK` — Updates hardware physical condition (`SERVICEABLE` $\to$ `DAMAGED`) with mandatory justification reason.
  18. `200 OK` — Retrieves condition mutation audit history records for the router.

  #### Suite 6: Edge Cases & Route Guarding (2 tests)
  19. `404 Not Found` — Returns not found when querying or mutating a non-existent router UUID.
  20. `400 Bad Request` — Rejects malformed / non-UUID route parameters.

