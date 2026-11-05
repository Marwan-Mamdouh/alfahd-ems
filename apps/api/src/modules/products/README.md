# 📦 ProductsModule (Catalog Management)

**Path:** `apps/api/src/modules/products`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** Stage 1 Autonomous Implementation (100% Type-Safe, Pure Drizzle ORM, TDD Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.6** and **CRM SRS Section 6 (Page 2)**:
* **Item Catalog:** Manages non-serialized consumables, cables, splitters, connectors, adapters, and tools (e.g., Drop Cable 1-Core, Fast Connector SC/UPC, Optical Splitter 1:8).
* **Product Model Reference for Routers (M2b):** While individual router units are tracked by their unique hardware `serialNumber` and state machine in `RoutersModule`, each physical router links to its catalog definition in `products` via `routers.productId`, ensuring aggregate warehouse counts reflect physical stock.
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
1. **`products` (`src/database/schema/index.ts`)**:
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

All routes dynamically consume the centralized route constants manifest (`src/common/constants/routes.constants.ts`):
* Controller: `@Controller(routes.products.root)`
* Param routes: `@Get(routes.products.id)`, `@Patch(routes.products.id)`, `@Delete(routes.products.id)`

Base Route: `/products` (prefixed per global NestJS API prefix)

| HTTP Method | Route | Description | Request Body / Query | Success Response | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/` | Create a new catalog product | `CreateProductDto` | `201 Created` (`Product`) | `400`, `409` |
| `GET` | `/` | List products with live stock | `QueryProductsDto` (`?search=&category=&isLowStock=&limit=20&offset=0`) | `200 OK` (`{ items: ProductWithStock[], total }`) | `400` |
| `GET` | `/:id` (`routes.products.id`) | Get single product with stock | None (UUID param) | `200 OK` (`ProductWithStock`) | `400`, `404` |
| `PATCH` | `/:id` (`routes.products.id`) | Update product details | `UpdateProductDto` | `200 OK` (`Product`) | `400`, `404`, `409` |
| `DELETE` | `/:id` (`routes.products.id`) | Safe delete product | None (UUID param) | `204 No Content` | `400`, `404`, `409` |

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

* **Integration & E2E Test Suite (`test/products.e2e-spec.ts`)**:
  * **13 test cases** across 2 testing suites verifying complete RBAC, route parameters, and deletion guards:

  #### Suite 1: Authentication & Authorization (RBAC) (8 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `200 OK` — Allows `TECHNICIAN` to view products catalog.
  3. `200 OK` — Allows `CS` (Customer Support) to read product details by ID.
  4. `403 Forbidden` — Blocks `CS` from creating catalog products.
  5. `403 Forbidden` — Blocks `TECHNICIAN` from creating catalog products.
  6. `201 Created` — Allows `WAREHOUSE_STAFF` to create a catalog product.
  7. `200 OK` — Allows `WAREHOUSE_STAFF` to patch product specifications.
  8. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from deleting a product.
  9. `204 No Content` — Allows `ADMIN` to delete an unused catalog product.

  #### Suite 2: Validation & Guard Invariants (5 tests)
  10. `400 Bad Request` — Rejects product creation when mandatory fields (name, SKU, model, category) are missing.
  11. `400 Bad Request` — Rejects product ID route parameter that is not a valid UUID.
  12. `409 Conflict` — Blocks creating a product when normalized SKU already exists in database.
  13. `404 Not Found` — Returns 404 when querying a non-existent product UUID.
  14. `409 Conflict` — Blocks deleting a product that currently has active stock in warehouse inventory.

### Running Verification Commands:
```bash
# Run all unit tests
pnpm --filter @alfahd/api test

# Run products E2E integration tests
pnpm --filter @alfahd/api test:e2e test/products.e2e-spec.ts

# Run strict TypeScript compiler check (0 errors)
pnpm --filter @alfahd/api typecheck

# Run linter
pnpm --filter @alfahd/api lint
```
