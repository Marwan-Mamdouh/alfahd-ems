# 📦 ProductsModule (Catalog Management)

**Path:** `apps/api/src/modules/products`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** Stage 1 Autonomous Implementation (100% Type-Safe, Pure Drizzle ORM, TDD Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.6** and **CRM SRS Section 6 (Page 2)**:
* **Item Catalog:** Manages non-serialized consumables, cables, splitters, connectors, adapters, and tools (e.g., Drop Cable 1-Core, Fast Connector SC/UPC, Optical Splitter 1:8).
* **Isolation from Routers:** Routers are serialized hardware tracked by unique `serialNumber` with a strict state machine in `RoutersModule`. They are intentionally **not** in this catalog.
* **Low-Stock Alerting:** Tracks a per-product `lowStockThreshold` (defaults to `10`). When the aggregated physical inventory across all warehouses drops below this threshold, the item is flagged with `isLowStock: true` for web dashboard alerts.
* **Guarded Deletion:** Products cannot be deleted if active warehouse stock exists or historical movements reference them in the audit ledger.

---

## 2. Architecture & The LMS 5-Layer Pattern

This module strictly adheres to the established LMS database layer architecture ([`DATABASE_LAYER_ARCHITECTURE.md`](file:///E:/alfahd-ems/Markdown/DATABASE_LAYER_ARCHITECTURE.md)):

```
┌──────────────────────────────────────────────────────────┐
│                   ProductsController                     │
│  - Exposes REST HTTP endpoints (/api/v1/products)        │
│  - Validates query params and DTO payloads               │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                     ProductsService                      │
│  - Business logic, SKU normalization, conflict checks     │
│  - Injects ONLY RepositoryService                        │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects single dependency:
                             ▼
┌──────────────────────────────────────────────────────────┐
│               RepositoryService (Facade)                 │
│  - Centralized injection facade: this.repo.products      │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates calls to:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   ProductsRepository                     │
│  - Pure Drizzle ORM queries (zero raw SQL templates)     │
│  - Complex joins, aggregations, and delete checks        │
└────────────────────────────┬─────────────────────────────┘
                             │ Extends:
                             ▼
┌──────────────────────────────────────────────────────────┐
│    BaseRepository<Product, NewProduct, typeof products>  │
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

## 3. Database Layer (`inventory.entity.ts` & `products.repository.ts`)

### A. The 3 Cooperating Tables
1. **`products` (`src/entities/inventory.entity.ts`)**:
   * The catalog blueprint. Does not have a `quantity` column because physical quantities belong to individual warehouses.
   * Key columns: `id` (UUID), `sku` (VARCHAR 100, unique), `name`, `model`, `category`, `description`, `lowStockThreshold` (INT, default 10).
2. **`warehouse_inventory`**:
   * Junction table holding current physical balances per warehouse.
   * Composite unique index on `(warehouse_id, product_id)`.
3. **`stock_movements`**:
   * Immutable audit ledger recording every inbound, outbound, transfer, and return receipt.

### B. Inferred Types (Zero `any`)
```typescript
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export interface ProductWithStock extends Product {
  totalStock: number;
  isLowStock: boolean;
}
```

### C. `ProductsRepository` Methods
* `findBySku(sku: string)`: Finds an existing product by normalized SKU for uniqueness validation.
* `findByIdWithStock(id: string)`: Performs a `leftJoin` on `warehouseInventory`, computes `sum(warehouseInventory.quantity).mapWith(Number)`, and sets `isLowStock: totalStock <= lowStockThreshold`.
* `findManyWithStock(params: QueryProductsParams)`:
  * Case-insensitive multi-column search with native `ilike()` + `or()`.
  * Dynamic filtering using Drizzle's `and(...)` operator.
  * Conditional `.having(params.isLowStock ? lte(...) : undefined)` for dashboard low-stock filters.
  * Returns `{ items: ProductWithStock[], total: number }`.
* `updateProduct(id: string, updates: Partial<NewProduct>)`: Updates specific product columns.
* `countProductStock(productId: string)`: Sums all units across warehouses for this item.
* `hasMovementHistory(productId: string)`: Checks if historical transaction rows reference this item.
* `canDeleteProduct(id: string)`: Safety guard combining stock check and audit history check.

---

## 4. Service Layer (`products.service.ts`)

The service acts as the business orchestrator and injects **only** `RepositoryService` (`this.repo.products`):

* **`createProduct(dto: CreateProductDto)`**:
  * Trims and uppercases `sku`.
  * Verifies SKU uniqueness (`findBySku`), throws `ConflictException` (409) if duplicate.
  * Inserts the new product record.
* **`findAll(query: QueryProductsDto)`**:
  * Forwards sanitized search, category, low-stock filter, limit, and offset to `findManyWithStock`.
* **`findById(id: string)`**:
  * Fetches product with aggregated stock; throws `NotFoundException` (404) if not found.
* **`update(id: string, dto: UpdateProductDto)`**:
  * Ensures product exists (404 check).
  * Validates SKU collision against other products if SKU is modified (409 check).
  * Enforces `lowStockThreshold >= 0`.
* **`remove(id: string)`**:
  * Ensures product exists (404 check).
  * Calls `canDeleteProduct(id)`. If `canDelete === false`, throws `ConflictException` (409) with the specific reason (active inventory or movement audit log exists).
  * Deletes via `deleteById(id)`.

---

## 5. Controller Layer & API Reference (`products.controller.ts`)

Base Route: `/api/v1/products`

| HTTP Method | Route | Description | Request Body / Query | Success Response | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Create a new catalog product | `CreateProductDto` | `201 Created` (`Product`) | `400`, `409` |
| `GET` | `/` | List products with live stock | `QueryProductsDto` (`?search=&category=&isLowStock=&limit=20&offset=0`) | `200 OK` (`{ items: ProductWithStock[], total }`) | `400` |
| `GET` | `/:id` | Get single product with stock | None (UUID param) | `200 OK` (`ProductWithStock`) | `400`, `404` |
| `PATCH` | `/:id` | Update product details | `UpdateProductDto` | `200 OK` (`Product`) | `400`, `404`, `409` |
| `DELETE` | `/:id` | Safe delete product | None (UUID param) | `204 No Content` | `400`, `404`, `409` |

### Input DTO Validations (`class-validator` / `class-transformer`)
* **`CreateProductDto`**:
  * `name`: string, required, max 255
  * `sku`: string, required, trimmed & uppercased automatically
  * `model`: string, required, max 255
  * `category`: string, required, max 100
  * `description`: string, optional, nullable
  * `lowStockThreshold`: integer, min 0, default 10
* **`QueryProductsDto`**:
  * `search`: string, optional
  * `category`: string, optional
  * `isLowStock`: boolean, optional (transforms string `'true'`/`'false'` to boolean)
  * `limit`: integer, min 1, max 100, default 20
  * `offset`: integer, min 0, default 0

---

## 6. Testing & Quality Assurance

Unit testing conforms strictly to TDD and runs via Vitest:

* **Service Unit Tests (`products.service.spec.ts`)**:
  * 11 comprehensive test cases mocking `RepositoryService.products`.
  * Verifies SKU collision, 404 handling, aggregate calculations, and deletion guards.
* **Controller Unit Tests (`products.controller.spec.ts`)**:
  * 6 test cases verifying HTTP handler delegation to `ProductsService`.

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

When the teammate building `AuthModule` and `UsersModule` delivers the authentication guards, integrate them in two simple steps:

1. **Attach Guards to `ProductsController`**:
   ```typescript
   import { UseGuards } from '@nestjs/common';
   import { JwtAuthGuard, RolesGuard } from '../auth/guards/index.js';
   import { Roles } from '../auth/decorators/roles.decorator.js';
   import { Role } from '@alfahd/types';

   @UseGuards(JwtAuthGuard, RolesGuard)
   @Controller('products')
   export class ProductsController {
     @Post()
     @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF)
     async create(...) { ... }

     @Get()
     @Roles(Role.ADMIN, Role.WAREHOUSE_STAFF, Role.CS)
     async findAll(...) { ... }

     @Delete(':id')
     @Roles(Role.ADMIN)
     async remove(...) { ... }
   }
   ```

2. **Add RBAC Integration Tests**:
   * Create `products-rbac.e2e-spec.ts` testing `401 Unauthorized` for unauthenticated requests and `403 Forbidden` for unauthorized roles (e.g. `Role.TECHNICIAN` attempting to delete a product).
