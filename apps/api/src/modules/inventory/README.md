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
  1. `INBOUND_SUPPLIER`: Vendor deliveries (free-text `supplierName` per SOW Section 6 out-of-scope rule).
  2. `OUTBOUND_TECHNICIAN`: Materials issued to technicians for field installation tickets.
  3. `RETURN_TECHNICIAN`: Unused or retrieved equipment returned from technicians to the warehouse.
  4. `TRANSFER_WAREHOUSE`: Inter-warehouse stock redistribution.
  5. `ADJUSTMENT`: Physical audit count reconciliations with mandatory justification notes.
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

### Running Verification Commands:
```bash
# Run all unit tests
pnpm --filter @alfahd/api test

# Run strict TypeScript compiler check (0 errors)
pnpm --filter @alfahd/api typecheck

# Run linter
pnpm --filter @alfahd/api lint
```

---

## 7. Stage 2: Handover Guide for Auth & RBAC Integration

When `AuthModule` and `UsersModule` are delivered by your teammate:

1. **Attach Guards & Current User**:
   ```typescript
   import { UseGuards } from '@nestjs/common';
   import { JwtAuthGuard, RolesGuard } from '../auth/guards/index.js';
   import { Roles } from '../auth/decorators/roles.decorator.js';
   import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
   import { Role } from '@alfahd/types';
   import { routes } from '../../common/constants/routes.constants.js';

   @UseGuards(JwtAuthGuard, RolesGuard)
   @Controller(routes.inventory.root)
   export class InventoryController {
     @Post(routes.inventory.inbound)
     @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
     async receiveInbound(@Body() dto: InboundStockDto, @CurrentUser() user: any) {
       return this.inventoryService.receiveInbound({ ...dto, responsibleUserId: user.id });
     }

     @Post(routes.inventory.outbound)
     @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
     async issueOutbound(@Body() dto: OutboundStockDto, @CurrentUser() user: any) {
       return this.inventoryService.issueOutbound({ ...dto, responsibleUserId: user.id });
     }

     @Post(routes.inventory.adjust)
     @Roles(Role.ADMIN) // High privilege: only admin can reconcile physical discrepancies
     async adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
       return this.inventoryService.adjustStock({ ...dto, responsibleUserId: user.id });
     }
   }
   ```
