# 🏢 WarehousesModule (Distribution Center & Geofence Management)

**Path:** `apps/api/src/modules/warehouses`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** M2b Complete (Guarded Soft-Deactivation, Router Physical Location Checks, 100% Type-Safe, Pure Drizzle ORM, TDD Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.4, Section 2.1.5**, **CRM SRS Section 5**, and **Milestone M2b Specification**:
* **Multi-Warehouse Management:** Regional distribution centers holding physical stock with street address, GPS coordinates (`latitude`, `longitude`), and optional manager assignment (`managerId`).
* **150m GPS Geofence Anchor:** Stores `geofenceRadiusMeters` (defaults to **150m** strictly per SOW Section 2.1.4), used as the spatial anchor for mobile attendance check-in by field technicians.
* **Name Uniqueness:** Warehouse names are unique across the system (e.g., "Cairo Main Hub", "Alexandria Branch"), trimmed and normalized.
* **Guarded Soft-Deactivation (M2b):** Per the M2b contract, warehouses are never hard-deleted. Instead, deletion triggers a guarded soft-deactivation (`isActive: false`). Deactivation is strictly blocked if:
  1. Active consumable inventory stock remains (`warehouse_inventory.quantity > 0`).
  2. Active employees/technicians are assigned to it (`users.assignedWarehouseId`).
  3. Routers are physically located at the warehouse (`routers.warehouseId = id`).

---

## 2. Architecture & The LMS 5-Layer Pattern

This module strictly adheres to the established LMS database layer architecture ([`DATABASE_LAYER_ARCHITECTURE.md`](file:///E:/alfahd-ems/Markdown/DATABASE_LAYER_ARCHITECTURE.md)):

```
┌──────────────────────────────────────────────────────────┐
│                   WarehousesController                   │
│  - REST HTTP endpoints (routes.warehouses.*)             │
│  - Validates query params and DTO payloads               │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                    WarehousesService                     │
│  - Business logic, uniqueness checks, delete guards      │
│  - Injects ONLY RepositoryService                        │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects single dependency:
                             ▼
┌──────────────────────────────────────────────────────────┐
│               RepositoryService (Facade)                 │
│  - Centralized injection facade: this.repo.warehouses    │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates calls to:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  WarehousesRepository                    │
│  - Pure Drizzle ORM queries (zero raw SQL templates)     │
│  - Multi-column search, pagination, active inventory     │
└────────────────────────────┬─────────────────────────────┘
                             │ Extends:
                             ▼
┌──────────────────────────────────────────────────────────┐
│ BaseRepository<Warehouse, NewWarehouse, typeof warehouses> │
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

## 3. Database Layer (`warehouses.entity.ts` & `warehouses.repository.ts`)

### A. Entity Definition
Defined in `apps/api/src/database/schema/index.ts` (the API exposes
`latitude`/`longitude`, mapped to the shared `gps_lat`/`gps_lng` columns):
* `id`: UUID primary key (default random)
* `name`: VARCHAR(255), not null
* `address`: VARCHAR(255)
* `latitude` (`gps_lat`): Double precision coordinate (-90 to 90)
* `longitude` (`gps_lng`): Double precision coordinate (-180 to 180)
* `geofenceRadiusMeters`: Integer, defaults to 150m (SOW 2.1.4)
* `managerId`: UUID referencing a user (no FK constraint, to avoid a circular
  reference with `users.assignedWarehouseId`)
* `createdAt` / `updatedAt`: Timestamps with timezone

### B. Inferred Types (Zero `any`)
```typescript
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
```

### C. `WarehousesRepository` Methods
* `findByName(name: string)`: Finds warehouse by trimmed name for uniqueness validation.
* `findManyWithPagination(params: QueryWarehousesParams)`:
  * Dynamic filtering using Drizzle's `and(...)` operator.
  * Multi-column search across `name` and `address` via native `ilike()` + `or()`.
  * Returns `{ items: Warehouse[], total: number }`.
* `updateWarehouse(id: string, updates: Partial<NewWarehouse>)`: Updates fields and returns updated record.
* `countActiveInventory(warehouseId: string)`: Aggregates total stock quantity across all products held in this warehouse using `sum().mapWith(Number)`.
* `countAssignedStaff(warehouseId: string)`: Counts total employees assigned to this warehouse.
* `countPhysicallyLocatedRouters(warehouseId: string)`: Counts routers physically located at this warehouse (`routers.warehouseId = warehouseId`).
* `canDeleteWarehouse(warehouseId: string)`: Guard preventing deactivation if active stock ($> 0$), assigned staff ($> 0$), or physically located routers ($> 0$) exist.
* `softDeactivate(warehouseId: string)`: Sets `isActive: false` on the warehouse record.

---

## 4. Service Layer (`warehouses.service.ts`)

The service acts as the business orchestrator and injects **only** `RepositoryService` (`this.repo.warehouses`):

* **`createWarehouse(dto: CreateWarehouseDto)`**:
  * Trims `name` and `address`.
  * Verifies name uniqueness (`findByName`), throws `ConflictException` (409) if duplicate.
  * Inserts the warehouse record with default 150m geofence and `isActive: true`.
* **`findAll(query: QueryWarehousesDto)`**:
  * Forwards sanitized search, limit, and offset to `findManyWithPagination`.
* **`findById(id: string)`**:
  * Fetches warehouse by ID; throws `NotFoundException` (404) if not found.
* **`update(id: string, dto: UpdateWarehouseDto)`**:
  * Ensures warehouse exists (404 check).
  * Validates name collision against other warehouses if name is changed (409 check).
  * Updates coordinates, geofence radius, address, or manager.
* **`remove(id: string)`**:
  * Ensures warehouse exists (404 check).
  * Calls `canDeleteWarehouse(id)`. If `canDelete === false`, throws `ConflictException` (409) with specific reason (active inventory, assigned employees, or located router hardware).
  * Performs safe soft deactivation via `softDeactivate(id)`.

---

## 5. Controller Layer & API Reference (`warehouses.controller.ts`)

All routes dynamically consume the centralized route constants manifest (`src/common/constants/routes.constants.ts`):
* Controller: `@Controller(routes.warehouses.root)`
* Param routes: `@Get(routes.warehouses.id)`, `@Patch(routes.warehouses.id)`, `@Delete(routes.warehouses.id)`

Base Route: `/warehouses`

| HTTP Method | Route | Description | Request Body / Query | Success Response | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Create a new warehouse | `CreateWarehouseDto` | `201 Created` (`Warehouse`) | `400`, `409` |
| `GET` | `/` | List warehouses with pagination & search | `QueryWarehousesDto` (`?search=&limit=20&offset=0`) | `200 OK` (`{ items: Warehouse[], total }`) | `400` |
| `GET` | `/:id` (`routes.warehouses.id`) | Get single warehouse | None (UUID param) | `200 OK` (`Warehouse`) | `400`, `404` |
| `PATCH` | `/:id` (`routes.warehouses.id`) | Update warehouse details | `UpdateWarehouseDto` | `200 OK` (`Warehouse`) | `400`, `404`, `409` |
| `DELETE` | `/:id` (`routes.warehouses.id`) | Safe delete warehouse | None (UUID param) | `204 No Content` | `400`, `404`, `409` |

### Input DTO Validations (`class-validator` / `class-transformer`)
* **`CreateWarehouseDto`**:
  * `name`: string, required, max 255, trimmed
  * `address`: string, required, trimmed
  * `latitude`: number, required, min -90, max 90
  * `longitude`: number, required, min -180, max 180
  * `geofenceRadiusMeters`: integer, optional, min 50, max 2000, default 150
  * `managerId`: UUIDv4 string, optional
* **`UpdateWarehouseDto`**:
  * All fields optional with identical validation rules.
* **`QueryWarehousesDto`**:
  * `search`: string, optional, trimmed
  * `limit`: integer, min 1, max 100, default 20
  * `offset`: integer, min 0, default 0

---

## 6. Testing & Quality Assurance

Unit testing conforms strictly to TDD and runs via Vitest:

* **Service Unit Tests (`warehouses.service.spec.ts`)**:
  * 12 comprehensive test cases mocking `RepositoryService.warehouses`.
  * Verifies unique name collisions, 404 handling, pagination, update collision checks, and guarded soft-deactivation (checking active inventory, staff, and router assets).
* **Controller Unit Tests (`warehouses.controller.spec.ts`)**:
  * 6 test cases verifying HTTP handler delegation to `WarehousesService`.

* **Integration & E2E Test Suite (`test/warehouses.e2e-spec.ts`)**:
  * **15 test cases** across 2 testing suites verifying complete RBAC, route parameters, and guarded deactivation:

  #### Suite 1: Authentication & Authorization (RBAC) (9 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `403 Forbidden` — Blocks `TECHNICIAN` from listing distribution warehouses.
  3. `200 OK` — Allows `WAREHOUSE_STAFF` to list and query warehouses.
  4. `200 OK` — Allows `CS` (Customer Support) to list warehouses for ticket lookups.
  5. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from creating a warehouse.
  6. `403 Forbidden` — Blocks `CS` from creating a warehouse.
  7. `201 Created` — Allows `ADMIN` to create a new distribution warehouse.
  8. `403 Forbidden` — Blocks non-`ADMIN` roles from updating warehouse configurations.
  9. `403 Forbidden` — Blocks non-`ADMIN` roles from deleting / soft-deactivating warehouses.

  #### Suite 2: Validation & Edge Cases (6 tests)
  10. `400 Bad Request` — Rejects warehouse creation when mandatory fields (name, coordinates) are missing.
  11. `400 Bad Request` — Rejects request when warehouse ID route parameter is not a valid UUID.
  12. `409 Conflict` — Blocks creating a warehouse when name already exists (case/trim collision).
  13. `404 Not Found` — Returns 404 when querying a non-existent warehouse UUID.
  14. `409 Conflict` — Blocks deleting/deactivating a warehouse with active inventory or located router assets.
  15. `204 No Content` — Successfully soft-deactivates an empty warehouse with no active stock or assigned routers.

### Running Verification Commands:
```bash
# Run all unit tests
pnpm --filter @alfahd/api test

# Run warehouse E2E integration tests
pnpm --filter @alfahd/api test:e2e test/warehouses.e2e-spec.ts

# Run strict TypeScript compiler check (0 errors)
pnpm --filter @alfahd/api typecheck

# Run linter
pnpm --filter @alfahd/api lint
```
