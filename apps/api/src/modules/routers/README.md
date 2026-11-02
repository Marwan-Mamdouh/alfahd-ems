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
* **Stock Delta Synchronization & Atomic Execution:**
  * When receiving new stock (`isNewReceipt: true`), the warehouse consumable inventory is atomically incremented (+1 `INBOUND_SUPPLIER`).
  * When assigned to a technician, warehouse stock is decremented (-1 `OUTBOUND_TECHNICIAN`).
  * When a warehouse unit suffers physical damage, warehouse stock is decremented (-1 `ADJUSTMENT`) while retaining the router asset record.
  * **Caller-Owned Transactions & Atomic Relative Deltas (Issue #51):** All mutations support an optional caller-owned `externalTx`. Conflicting operations serialize via row-level locks (`findByIdForUpdate`), and inventory changes use atomic relative SQL deltas (`GREATEST(0, quantity + delta)`) rather than unprotected read-modify-write.
* **Audited Existing-Stock Onboarding Capacity (Issue #52):**
  * When onboarding existing warehouse stock (`isNewReceipt: false`), registration consumes pre-existing physical inventory without generating an inbound movement.
  * Enforces capacity: verifies that recorded stock is greater than zero and exceeds currently registered serviceable units in the warehouse (`availableCapacity = currentStock - registeredCount > 0`). If stock is 0 or all stock already has serial numbers assigned, throws `409 Conflict`.
  * Reconciles damaged opening stock: registering a damaged unit (`isNewReceipt: false`, `DAMAGED`) records a -1 `ADJUSTMENT` movement and writes an explicit reconciliation record in `router_condition_history`.
* **Warehouse Deactivation Serialization & Placement Invariants (Issue #57 - T07):**
  * All placement paths (`create`, `transition` to `RETURNED`, `transition` to `AVAILABLE`, and `updateCondition`) validate the target warehouse active status under a pessimistic row lock (`findByIdForUpdate(warehouseId, tx)`).
  * Inactive target warehouses are strictly rejected with `BadRequestException` (400).
  * In `updateCondition`, multi-warehouse operations (transfers) lock involved warehouses in deterministic alphabetical order to prevent AB-BA transaction deadlocks.
  * During warehouse deactivation, active inventory, assigned staff/technicians, physically present routers (including damaged/under-repair devices without active custody), and active custody records strictly block deactivation with `409 Conflict`.
* **Customer Installation Custody Handoff (Issue #58 - T08):**
  * Transitions from `ASSIGNED_TO_TECHNICIAN` to `INSTALLED_AT_CUSTOMER` atomically close the technician's active custody assignment and create the approved customer custody assignment (`holderType: 'CUSTOMER'`) in the same database transaction.
  * Eliminates contradictory state where a technician remains the active custody holder of a deployed customer unit.
  * Implemented without premature customer tables or foreign keys (customer details held via assignment notes/metadata).
  * Validates preconditions: requires the router to be `SERVICEABLE` and to possess verified active technician custody. Rejects warehouse targets for customer installations.
  * Returning an installed router (`INSTALLED_AT_CUSTOMER` $\to$ `RETURNED`) cleanly closes customer custody and requires a verified active target warehouse (`targetWarehouseId`).
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
* `findByIdForUpdate(id, tx)`: Row-level pessimistic locking (`FOR UPDATE`) to serialize concurrent assignments and transitions within transactions.
* `countRegisteredUsableInWarehouse(warehouseId, productId, tx?)`: Counts active serviceable routers currently in warehouse custody to enforce onboarding capacity.
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

* **`create(dto: CreateRouterDto, userId, externalTx?)`**:
  * Orchestrated inside `externalTx` or a managed transaction.
  * Validates warehouse existence and active status (rejects deactivated hubs).
  * Validates catalog product existence.
  * Verifies unique `serialNumber` (throws `ConflictException` 409).
  * **Capacity Check (`isNewReceipt: false`):** Locks inventory row via `getStockForUpdate`, ensures recorded stock > 0, and verifies registered serviceable count < recorded stock; throws `409 Conflict` if capacity exhausted.
  * **Damaged Reconciliation (`isNewReceipt: false`, `DAMAGED`):** Deducts 1 opening unit via `ADJUSTMENT` movement and writes audit log in `router_condition_history`.
  * Opens initial warehouse custody assignment if condition is `SERVICEABLE`.
  * If `isNewReceipt: true`, atomically increments warehouse inventory (+1 `INBOUND_SUPPLIER`) via `recordMovementWithDelta`.
* **`assign(id, dto: AssignRouterDto, userId, externalTx?)`**:
  * Serializes competing requests by acquiring a row lock on the router (`findByIdForUpdate`).
  * Guard: Router must be `AVAILABLE`, `SERVICEABLE`, and located in a warehouse (competing requests fail with `409 Conflict`).
  * Releases previous warehouse custody and opens new `TECHNICIAN` custody record.
  * Sets status to `ASSIGNED_TO_TECHNICIAN`.
  * Decrements warehouse stock (-1 `OUTBOUND_TECHNICIAN`) via atomic SQL delta.
* **`transition(id, dto: TransitionRouterDto, userId, externalTx?)`**:
  * Serializes requests via `findByIdForUpdate` and validates transition against `ALLOWED_ROUTER_TRANSITIONS` whitelist:
    * `AVAILABLE` $\rightarrow$ `ASSIGNED_TO_TECHNICIAN` (via assign endpoint).
    * `ASSIGNED_TO_TECHNICIAN` $\rightarrow$ `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `LOST`.
    * `RETURNED` $\rightarrow$ `AVAILABLE`, `UNDER_REPAIR`, `DAMAGED`.
    * `DAMAGED` $\rightarrow$ `UNDER_REPAIR`, `DECOMMISSIONED`.
    * `UNDER_REPAIR` $\rightarrow$ `AVAILABLE`, `DECOMMISSIONED`.
    * Terminal states (`LOST`, `DECOMMISSIONED`): no transitions permitted.
* **`updateCondition(id, dto: UpdateRouterConditionDto, userId, externalTx?)`**:
  * Serializes requests via `findByIdForUpdate`. Rejects modifications to terminal states (`LOST`, `DECOMMISSIONED`).
  * **Explicit Location Resolution (Issue #53):** External placement (`externalLocation`) explicitly clears physical warehouse placement (`warehouseId = null`). Explicit `warehouseId` clears `externalLocation` and validates active warehouse status.
  * **State-Derived Usable Contribution & Atomic Deltas (Issue #53):**
    * Calculates before/after usable contribution: contributes exactly 1 unit to warehouse $W$ iff lifecycle is `AVAILABLE`, condition is `SERVICEABLE`, and physical placement is $W$.
    * **Inter-Warehouse Move ($A \to B$):** Atomically decrements $A$ (-1 `TRANSFER_WAREHOUSE`), increments $B$ (+1 `TRANSFER_WAREHOUSE`), closes custody on $A$, and opens custody on $B$.
    * **Damaged / Under Repair ($W \to \emptyset$):** Both `DAMAGED` and `UNDER_REPAIR` remove usable contribution (-1 `ADJUSTMENT`) and close active custody (empty custody).
    * **External Repair ($\to$ external):** Clears physical warehouse placement while preserving prior warehouse in `router_condition_history` (`fromWarehouseId: A`, `toWarehouseId: null`).
    * **Restoring Serviceability ($\emptyset \to W$):** Increments destination warehouse stock (+1 `ADJUSTMENT`) and restores warehouse custody only when lifecycle is `AVAILABLE` and located in a warehouse.
  * Logs comprehensive condition and location transition history in `router_condition_history`.
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
  * [`routers.service.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/routers/routers.service.spec.ts) (**22 tests**): Verifies receipt stock deltas, assignment custody, whitelist state transitions, warehouse damage adjustment, atomic writes, rollback on injected failure, competing assignment serialization, existing stock capacity limits, damaged opening unit reconciliation, A-to-B inter-warehouse moves, direct UNDER_REPAIR stock/custody removals, external repair clearing, and conditional serviceability restoration.
  * [`routers.controller.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/routers/routers.controller.spec.ts) (**10 tests**): Verifies HTTP delegation and DTO validation.

* **Integration & E2E Test Suite**:
  * [`test/routers.e2e-spec.ts`](file:///e:/alfahd-ems/apps/api/test/routers.e2e-spec.ts) (**29 test cases** across 7 testing suites):
  
  #### Suite 1: Authentication & RBAC (7 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `200 OK` — Allows `TECHNICIAN` to query and read paginated router lists.
  3. `200 OK` — Allows `CS` (Customer Support) to read single router details by ID.
  4. `403 Forbidden` — Blocks `CS` from registering new physical routers.
  5. `403 Forbidden` — Blocks `TECHNICIAN` from registering new physical routers.
  6. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from dispatching router inventory Excel exports.
  7. `200 OK` — Allows `ADMIN` to trigger async router inventory Excel exports with `{ jobId }`.

  #### Suite 2: Router Registration / Inbound & Capacity Limits (7 tests)
  8. `201 Created` — Allows `WAREHOUSE_STAFF` to register a valid router asset.
  9. `409 Conflict` — Rejects router registration when `serialNumber` already exists in database.
  10. `400 Bad Request` — Blocks registration when target warehouse is soft-deactivated (`isActive: false`).
  11. `400 Bad Request` — Blocks registration when mandatory `serialNumber` is omitted.
  12. `409 Conflict` — Rejects existing-stock onboarding (`isNewReceipt: false`) against zero recorded stock (Issue #52).
  13. `409 Conflict` — Rejects existing-stock onboarding when registered serials already equal recorded stock capacity (Issue #52).
  14. `201 Created` — Reconciles damaged opening unit (`isNewReceipt: false`, `DAMAGED`) by applying -1 `ADJUSTMENT` movement (Issue #52).

  #### Suite 3: Custody Assignment & Handoff (3 tests)
  15. `200 OK` — Assigns an `AVAILABLE` router to a technician, sets status to `ASSIGNED_TO_TECHNICIAN`, and records custody interval.
  16. `409 Conflict` — Blocks assignment when router already has an active open assignment (`releasedAt IS NULL`).
  17. `200 OK` — Retrieves chronological custody assignment history for an individual router.

  #### Suite 4: Lifecycle State Machine Transitions (2 tests)
  18. `200 OK` — Transitions router status along the approved transition whitelist (`ASSIGNED_TO_TECHNICIAN` $\to$ `RETURNED`).
  19. `400 Bad Request` — Rejects illegal lifecycle transitions (`RETURNED` $\to$ `INSTALLED_AT_CUSTOMER`) not defined in the contract whitelist.

  #### Suite 5: Physical Condition, Location Updates & Warehouse Stock Deltas (6 tests)
  20. `200 OK` — Updates hardware physical condition (`SERVICEABLE` $\to$ `DAMAGED`) with mandatory justification reason.
  21. `200 OK` — Retrieves condition mutation audit history records for the router.
  22. `200 OK` — A-to-B move decrements A (-1), increments B (+1), and moves warehouse custody once (Issue #53).
  23. `200 OK` — Removing usable contribution directly to `UNDER_REPAIR` decrements stock and clears custody (Issue #53).
  24. `200 OK` — Sending to external repair clears physical warehouse placement while retaining prior warehouse location in audit trail (Issue #53).
  25. `200 OK` — Restoring serviceability upon return adds stock and creates warehouse custody at destination warehouse (Issue #53).

  #### Suite 6: Atomicity, Concurrency & Rollback Invariants (2 tests)
  26. `201 Created` — Concurrent receipts preserve both increments on initially missing stock rows without lost updates (Issue #51).
  27. `200 OK` / `409 Conflict` — Competing assignments cannot both succeed; one succeeds and one receives 409 Conflict (Issue #51).

  #### Suite 7: Edge Cases & Route Guarding (2 tests)
  28. `404 Not Found` — Returns not found when querying or mutating a non-existent router UUID.
  29. `400 Bad Request` — Rejects malformed / non-UUID route parameters.

