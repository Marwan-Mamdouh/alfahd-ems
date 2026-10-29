# Backend Codebase Reading Guide & M2b Roadmap

> **Target Audience:** Ahmed (WS-B / Backend)  
> **Date:** October 2026  
> **Goal:** Get completely up to speed with the existing backend architecture, understand what changes your teammate made to `warehouses`, `products`, and `inventory`, and prepare for implementing **M2b (Supply Chain)**.

---

## 1. Executive Summary: What Happened While You Were Away

When you last worked on the codebase, you built the foundation for `warehouses`, `products`, and `inventory` using draft schemas in `src/entities/`. 

Here is what your teammate (Marwan) updated:
1. **Consolidated Schema into Canonical Drizzle (`apps/api/src/database/schema/index.ts`)**:
   - Draft tables were migrated into the official schema file.
   - Generated migration `0004_bored_krista_starr.sql` adding `products`, `warehouse_inventory`, and `stock_movements`.
   - Updated `warehouses` table to add `geofence_radius_meters` and `manager_id`.
   - Added validation helpers like `canDeleteWarehouse` in `warehouses.repository.ts`.
2. **Auth, Roles & Integration Tests**:
   - Added Swagger documentation decorators across controllers.
   - Standardized controller decorators using `@CurrentUser()` and `@Roles()`.
   - Ensured integration/E2E test suites pass with zero container dependencies (in-memory test stubs).
3. **M2b Contract Formalization (`docs/contracts/m2b-supply-implementation.md`)**:
   - Formalized the exact requirements for routers, physical condition, custody, IP management, and Excel reports.
   - Updated `packages/types/src/index.ts` with the new tuples: `ROUTER_STATUSES`, `ROUTER_HOLDER_TYPES`, `IP_STATUSES`.

---

## 2. Codebase Map: All Existing Modules

The API currently consists of **13 modules** in `apps/api/src/` (~4,500 lines of executable code):

| Module | Files / Lines | Purpose & Current State |
| :--- | :---: | :--- |
| **`modules/warehouses`** | 8 files / ~291 loc | Warehouse CRUD, coordinates, geofence radius. *(M2b will replace hard delete with guarded soft deactivation).* |
| **`modules/products`** | 7 files / ~282 loc | Product catalog / SKU items, low-stock threshold alerts. Fully completed. |
| **`modules/inventory`** | 11 files / ~466 loc | Quantity stock per warehouse (`warehouse_inventory`) and movement audit trail (`stock_movements`). |
| **`modules/repository`** | 6 files / ~579 loc | Central data-access layer (`BaseRepository`, `WarehousesRepository`, `ProductsRepository`, `InventoryRepository`). |
| **`database`** | 4 files / ~295 loc | Drizzle ORM client, canonical schema (`schema/index.ts`), migration runner, and seeding. |
| **`jobs`** | 3 files / ~88 loc | BullMQ generic job status endpoint (`GET /jobs/:id`). Used by async report exports. |
| **`storage`** | 4 files / ~149 loc | Storage provider abstraction (`StorageService`) with Cloudinary and fake implementations. |
| **`attendance`** | 7 files / ~553 loc | Technician check-in/out, GPS Haversine verification, and BullMQ worker (`attendance.worker.ts`) for Excel exports. |
| **`employees`** | 7 files / ~333 loc | Employee profile management, national ID, department/role filtering, photo upload. |
| **`auth`** | 12 files / ~563 loc | JWT login, cookie-based token refresh, argon2id hashing, Redis rate limiter, password reset. |
| **`users`** | 4 files / ~526 loc | User CRUD, `@Roles()` guards, Redis session revocation (`SCAN rt:<userId>:*`). |
| **`redis`** | 3 files / ~168 loc | Redis connection pool and refresh-token session management (`SessionService`). |
| **`email`** | 4 files / ~115 loc | Nodemailer SMTP / SendGrid email delivery for password resets and invitations. |

---

## 3. Recommended Reading Path & Time Estimates

You do **not** need to read the entire codebase in full detail. Focus on the core dependencies of M2b first.

### Total Estimated Reading Time: **~2.5 to 3.5 hours**

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Core M2b Dependencies (~90 - 120 mins)              │
│ Contract -> Drizzle Schema -> Repositories -> Supply Modules│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Tier 2: Shared Infrastructure & Jobs (~45 mins)             │
│ BullMQ Jobs -> Storage -> Auth/RBAC Guards                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ Tier 3: Context / Background (~20 mins)                     │
│ Types Tuples -> Seeding & DB Scripts                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Step-by-Step Reading Checklist

#### Tier 1: Must Read First (The Core of M2b) — ~105 mins

- [ ] **1. The Implementation Contract** (~20 mins)
  - **File:** `docs/contracts/m2b-supply-implementation.md`
  - **Why:** This is the single source of truth for M2b. Pay close attention to:
    - §4: Lifecycle vs. Physical Condition vs. Custody vs. Physical Location (do not collapse these into one field).
    - §5: Stock accounting: Existing Stock Registration vs. New Inbound Receipt.
    - §7: IP management: strictly `FREE` and `RESERVED` statuses; technician allocation deferred to tickets.
    - §12: Technical freeze items.

- [ ] **2. The Canonical Database Schema** (~15 mins)
  - **File:** `apps/api/src/database/schema/index.ts`
  - **Why:** See how `warehouses`, `products`, `warehouseInventory`, and `stockMovements` are defined in Drizzle. Your new tables (`routers`, `routerAssignments`, `ipAddresses`, `ipHistory`) will sit directly here.

- [ ] **3. The Repository Layer & Transactions** (~25 mins)
  - **Files:**
    - `apps/api/src/modules/repository/repositories/base.repository.ts`
    - `apps/api/src/modules/repository/repositories/warehouses.repository.ts`
    - `apps/api/src/modules/repository/repositories/inventory.repository.ts`
    - `apps/api/src/modules/repository/repository.service.ts`
  - **Why:** In M2b, router state transitions must update router status, open/close custody, update quantity stock, and create stock movement rows **in a single database transaction**. See how `repo.transaction(...)` or Drizzle transactions are passed.

- [ ] **4. The Existing 3 Modules (Warehouses, Products, Inventory)** (~30 mins)
  - **Files:**
    - `apps/api/src/modules/warehouses/warehouses.service.ts`
    - `apps/api/src/modules/products/products.service.ts`
    - `apps/api/src/modules/inventory/inventory.service.ts`
  - **Why:**
    - `WarehousesService`: Note `remove()` — in M2b you will convert this to soft-deactivation (`isActive = false`) checking for attached routers and technicians.
    - `InventoryService`: Note `inbound()`, `outbound()`, `transfer()`, `return()`, `adjust()` — your router operations will atomically invoke or mirror these stock adjustments.

- [ ] **5. The Async Report Pipeline & Worker** (~15 mins)
  - **Files:**
    - `apps/api/src/jobs/jobs.service.ts` & `jobs.controller.ts`
    - `apps/api/src/attendance/attendance.worker.ts`
  - **Why:** M2b requires an async router inventory Excel report. You will reuse this exact BullMQ `reports` queue and `JobStatusResponseDto` pattern instead of inventing a new queue or running exports synchronously.

---

#### Tier 2: Supporting Infrastructure — ~40 mins

- [ ] **6. Auth & RBAC Guards** (~15 mins)
  - **Files:**
    - `apps/api/src/auth/guards/jwt-auth.guard.ts`
    - `apps/api/src/auth/guards/roles.guard.ts`
    - `apps/api/src/auth/decorators/roles.decorator.ts`
    - `apps/api/src/auth/decorators/current-user.decorator.ts`
  - **Why:** M2b endpoints have specific RBAC (e.g. `POST /routers/:id/assign` allows `ADMIN` and `WAREHOUSE_STAFF`; IP CSV import is `ADMIN` only; IP read is open to `TECHNICIAN`).

- [ ] **7. Storage Service & Excel Generation** (~15 mins)
  - **Files:**
    - `apps/api/src/storage/storage.interface.ts`
    - `apps/api/src/storage/cloudinary.service.ts`
    - `apps/api/src/common/utils/spreadsheet.utils.ts`
  - **Why:** Understand how generated buffers are uploaded and sanitized against formula injection.

- [ ] **8. Shared Types & Enum Tuples** (~10 mins)
  - **File:** `packages/types/src/index.ts`
  - **Why:** Check `ROUTER_STATUSES`, `ROUTER_HOLDER_TYPES`, `IP_STATUSES`. All API and database enums must derive from these `as const` tuples.

---

#### Tier 3: Reference Only (Read as needed) — ~15 mins

- `apps/api/src/attendance/attendance.service.ts`: Only to see how warehouse coordinates are read for geofencing.
- `apps/api/src/users/users.service.ts`: To see how user sessions are fetched/revoked.
- `apps/api/test/test-utils.ts`: To understand the test harness when writing tests for M2b.

---

## 4. Key Architectural Patterns to Follow in M2b

When implementing M2b, strictly adhere to these patterns established by the codebase:

1. **Tuple-Derived Enums**:
   - Tuples defined in `packages/types/src/index.ts`.
   - Drizzle `pgEnum('name', TUPLE)` in `apps/api/src/database/schema/index.ts`.
   - Never use TypeScript's `enum` keyword.
2. **ESM Import Syntax**:
   - Relative imports inside `apps/api/src/` **must include the explicit `.js` extension** (e.g., `import { warehouses } from './database/schema/index.js'`).
3. **Atomic Operations with Caller-Owned Transactions**:
   - Router operations (assign, damage, repair, return) must accept an optional transaction context:
     ```ts
     async transition(id: string, toStatus: RouterStatus, opts?: { tx?: DrizzleTransaction, ... })
     ```
   - This ensures M3a (Tickets) can later include router assignment in ticket closure without rewriting your service.
4. **Soft Deletes Only**:
   - Never use `DELETE FROM`. Use status fields (`isActive = false`, `status = 'DECOMMISSIONED'`, `isArchived = true`).
5. **Async BullMQ Jobs for Heavy Work**:
   - Router Excel generation and 1,000+ IP CSV imports run via BullMQ queues, returning `{ jobId }` immediately.

---

## 5. Summary Checklist Before You Start Coding M2b

1. [ ] Rebase on latest `origin/master`.
2. [ ] Build shared types: `pnpm --filter @alfahd/types build`.
3. [ ] Follow the reading checklist above (~2.5 hrs).
4. [ ] Create a feature branch: `git switch -c feat/m2b-supply-chain`.
5. [ ] Review §12 of `m2b-supply-implementation.md` for technical proposals (exact condition values, CSV headers).

