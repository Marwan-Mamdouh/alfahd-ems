# 📦 InventoryModule (Warehouse Balances & Stock Movements)

**Path:** `apps/api/src/modules/inventory`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** Stage 1 Autonomous Implementation (100% Type-Safe, Pure Drizzle ORM, TDD Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.6, Section 4.1, Section 6** and **CRM SRS Section 6**:
* **Warehouse Stock Balances:** Tracks physical counts of products across regional hubs via `warehouse_inventory`. Quantities can never be negative (< 0).
* **Immutable Audit Ledger:** Every stock change appends a record into `stock_movements`. Movements cannot be updated or deleted.
* **5 Supported Movement Types:**
  1. `INBOUND_SUPPLIER`: Vendor deliveries (free-text `supplierName` per SOW Section 6 out-of-scope rule; also triggered automatically on new router receipts `isNewReceipt: true`).
  2. `OUTBOUND_TECHNICIAN`: Materials issued to technicians for field installation tickets (also triggered when a router is handed over to a technician).
  3. `RETURN_TECHNICIAN`: Unused or retrieved equipment returned from technicians to the warehouse (also triggered when a returned router is re-inspected as available).
  4. `TRANSFER_WAREHOUSE`: Inter-warehouse stock redistribution.
  5. `ADJUSTMENT`: Physical audit count reconciliations with mandatory justification notes (also triggered when an in-warehouse router is marked damaged, decrementing usable stock).
* **Cross-Module Integration (M2b Routers):** In Milestone M2b, `RoutersService` calls `this.repo.inventory.recordMovementInTransaction` within its transactional boundaries so serialized router movements keep aggregate warehouse balances 100% in sync.
* **Database Transactions:** All balance changes and movement records are committed atomically via `db.transaction()`.

---

## 2. Architecture & The LMS 5-Layer Pattern

This module strictly adheres to the established LMS database layer architecture ([`DATABASE_LAYER_ARCHITECTURE.md`](file:///E:/alfahd-ems/Markdown/DATABASE_LAYER_ARCHITECTURE.md)):

```
┌──────────────────────────────────────────────────────────┐
│                   InventoryController                    │
│  - REST HTTP endpoints (routes.inventory.*)              │
│  - Validates query params and DTO payloads               │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                     InventoryService                     │
│  - Stock availability checks, transaction orchestration  │
│  - Injects ONLY RepositoryService                        │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects single dependency:
                             ▼
┌──────────────────────────────────────────────────────────┐
│               RepositoryService (Facade)                 │
│  - Centralized injection facade: this.repo.inventory     │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates calls to:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  InventoryRepository                     │
│  - Pure Drizzle ORM queries (zero raw SQL templates)     │
│  - Atomic balance upserts, joins, audit trail queries    │
└────────────────────────────┬─────────────────────────────┘
                             │ Extends:
                             ▼
┌──────────────────────────────────────────────────────────┐
│BaseRepository<WarehouseInventory, NewWarehouseInventory> │
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

## 3. Database Layer (`inventory.entity.ts` & `inventory.repository.ts`)

### A. Tables
1. **`warehouse_inventory`**:
   - `id`: UUID primary key
   - `warehouseId`: References `warehouses.id` (cascade delete)
   - `productId`: References `products.id` (cascade delete)
   - `quantity`: Integer ($\ge 0$)
   - `updatedAt`: Timestamp
   - Unique composite index: `(warehouse_id, product_id)`
2. **`stock_movements`**:
   - `id`: UUID primary key
   - `warehouseId`: References `warehouses.id`
   - `productId`: References `products.id`
   - `movementType`: `stockMovementTypeEnum`
   - `quantity`: Integer (positive for inbound/returns, negative for outbound)
   - `supplierName`: VARCHAR(255) (optional, used on inbound)
   - `technicianId`: UUID referencing `users.id` (optional, used on tech hand-offs)
   - `responsibleUserId`: UUID referencing `users.id` (staff performing the action)
   - `notes`: TEXT (mandatory for adjustments)
   - `createdAt`: Timestamp with timezone

### B. Inferred Types (Zero `any`)
```typescript
export type WarehouseInventory = typeof warehouseInventory.$inferSelect;
export type NewWarehouseInventory = typeof warehouseInventory.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
```

### C. `InventoryRepository` Methods
* `getStock(warehouseId, productId)`: Fetches current stock row.
* `findManyInventory(params)`: Returns paginated stock balances joined with product details (SKU, name, category, lowStockThreshold) and warehouse details.
* `recordMovementInTransaction(movement, newQuantity)`: Atomically upserts `warehouse_inventory` and inserts into `stock_movements`.
* `executeTransferInTransaction(...)`: Atomically deducts from source warehouse, adds to destination warehouse, and records two transfer movements.
* `findManyMovements(params)`: Queries paginated movement audit logs with filters (`warehouseId`, `productId`, `movementType`, `technicianId`).
* `findMovementById(id)`: Fetches a single audit transaction record.

---

## 4. Service Layer (`inventory.service.ts`)

The service acts as the business orchestrator and injects **only** `RepositoryService`:

* **`receiveInbound(dto)`**: Verifies warehouse & product exist $\to$ computes `newQuantity = current + qty` $\to$ records movement in transaction.
* **`issueOutbound(dto)`**: Verifies stock availability (`current >= qty`); throws `BadRequestException` if insufficient $\to$ deducts stock $\to$ records movement in transaction.
* **`receiveReturn(dto)`**: Increments stock balance $\to$ records `RETURN_TECHNICIAN` movement.
* **`transferStock(dto)`**: Validates `from !== to` $\to$ verifies source stock availability $\to$ atomically executes transfer.
* **`adjustStock(dto)`**: Computes delta (`newQuantity - current`) $\to$ updates balance with mandatory notes $\to$ records `ADJUSTMENT` movement.
* **`findAllStock(query)`** & **`findMovements(query)`**: Retrieves paginated live balances and historical movement ledgers.

---

## 5. Controller Layer & API Reference (`inventory.controller.ts`)

All routes dynamically consume the centralized route constants manifest (`src/common/constants/routes.constants.ts`):
* Base Controller: `@Controller(routes.inventory.root)` (`/inventory`)

| HTTP Method | Route | Description | Request Body / Query | Success Response | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | List stock balances with details | `QueryInventoryDto` (`?warehouseId=&productId=&limit=20&offset=0`) | `200 OK` (`{ items, total }`) | `400` |
| `GET` | `/warehouses/:warehouseId` | List stock for specific warehouse | `QueryInventoryDto` | `200 OK` (`{ items, total }`) | `400` |
| `POST` | `/inbound` | Receive stock from supplier | `InboundStockDto` | `201 Created` | `400`, `404` |
| `POST` | `/outbound` | Issue equipment to technician | `OutboundStockDto` | `201 Created` | `400`, `404` |
| `POST` | `/returns` | Return equipment from technician | `ReturnStockDto` | `201 Created` | `400`, `404` |
| `POST` | `/transfer` | Inter-warehouse stock transfer | `TransferStockDto` | `200 OK` | `400`, `404` |
| `POST` | `/adjust` | Physical audit count adjustment | `AdjustStockDto` | `200 OK` | `400`, `404` |
| `GET` | `/movements` | Query immutable audit ledger | `QueryStockMovementsDto` | `200 OK` (`{ items, total }`) | `400` |
| `GET` | `/movements/:id` | View single audit transaction | None (UUID param) | `200 OK` | `400`, `404` |

---

## 6. Testing & Quality Assurance

Unit testing conforms strictly to TDD and runs via Vitest:

* **Service Unit Tests (`inventory.service.spec.ts`)**:
  * 15 comprehensive test cases covering inbound receipts, outbound stock checks, insufficient stock guards, technician returns, atomic transfers, same-warehouse rejections, physical adjustments, and audit trail queries.
* **Controller Unit Tests (`inventory.controller.spec.ts`)**:
  * 10 test cases verifying route delegation, status codes, and query params forwarding.

* **Integration & E2E Test Suite (`test/inventory.e2e-spec.ts`)**:
  * **12 test cases** across 3 testing suites verifying complete RBAC, user context binding, and inventory invariants:

  #### Suite 1: Authentication & Authorization (RBAC) (7 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `403 Forbidden` — Blocks `TECHNICIAN` from querying inventory balances.
  3. `200 OK` — Allows `CS` (Customer Support) to query inventory stock.
  4. `200 OK` — Allows `WAREHOUSE_STAFF` to query warehouse-specific stock balances.
  5. `403 Forbidden` — Blocks `CS` from executing inbound stock receipts.
  6. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from executing physical stock adjustments (reconciliations).
  7. `200 OK` — Allows `ADMIN` to perform stock adjustments with mandatory justification.

  #### Suite 2: User Context Injection (`@CurrentUser`) (1 test)
  8. `201 Created` — Automatically extracts authenticated user ID from JWT and populates `responsibleUserId` in the audit ledger.

  #### Suite 3: Inventory Validation & Transaction Invariants (4 tests)
  9. `400 Bad Request` — Rejects inbound receipts when quantity is zero or negative ($\le 0$).
  10. `404 Not Found` — Returns 404 when inbound targets a non-existent warehouse UUID.
  11. `400 Bad Request` — Blocks outbound dispatch when requested quantity exceeds current available stock.
  12. `400 Bad Request` — Rejects inter-warehouse transfer when source and destination warehouse are identical.
  13. `200 OK` — Successfully processes inter-warehouse stock transfer atomically between two distinct warehouses.

### Running Verification Commands:
```bash
# Run all unit tests
pnpm --filter @alfahd/api test

# Run inventory E2E integration tests
pnpm --filter @alfahd/api test:e2e test/inventory.e2e-spec.ts

# Run strict TypeScript compiler check (0 errors)
pnpm --filter @alfahd/api typecheck

# Run linter
pnpm --filter @alfahd/api lint
```
