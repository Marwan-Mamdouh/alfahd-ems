# Frontend API & React Query Architecture Conventions

This directory defines the core React Query conventions, key factories, and cache invalidation policies for Phase 2 of the Fahd EMS Dashboard.

---

## 1. Query Key Hierarchy & Factories

All cache keys must be generated using the centralized factories in [`query-keys.ts`](./query-keys.ts). Never declare ad-hoc string arrays in components.

### Factory Hierarchy Pattern

```
domain.all                             // ["domain"] - broad invalidation target
├── domain.lists()                     // ["domain", "list"] - all lists
│   └── domain.list(params)            // ["domain", "list", { page: 1, ... }]
└── domain.details()                   // ["domain", "detail"] - all details
    ├── domain.detail(id)              // ["domain", "detail", "id-1"]
    └── domain.subResource(id)         // ["domain", "detail", "id-1", "sub-resource"]
```

---

## 2. Cross-Module Cache Invalidation Matrix

When mutations take place, they frequently impact related data domains. The table below documents cross-module invalidation ownership to keep client state synchronized:

| Mutation Action | Responsible Task | Primary Invalidation | Cross-Module Invalidations |
| :--- | :--- | :--- | :--- |
| **Warehouse Update / Soft-Deactivate** | B2 (#70) | `queryKeys.warehouses.all` | `queryKeys.inventory.all` |
| **Product Create / Update** | B2 (#70) | `queryKeys.products.all` | `queryKeys.inventory.all` |
| **Product Soft-Deactivate / Archive** | B7 (#77) | `queryKeys.products.all` | `queryKeys.products.detail(id)`, `queryKeys.inventory.all` |
| **Inbound / Outbound / Return / Transfer / Adjust** | B3 (#71) | `queryKeys.inventory.all` | `queryKeys.products.all`, `queryKeys.warehouses.detail(id).stock` |
| **Router Create / Onboard (`isNewReceipt`)** | B4 (#72) | `queryKeys.routers.all` | `queryKeys.inventory.all`, `queryKeys.products.all` (if `isNewReceipt` added stock) |
| **Router Assign to Technician** | B5 (#73) | `queryKeys.routers.detail(id)` | `queryKeys.routers.lists()`, `queryKeys.inventory.warehouseStock(whId)` |
| **Router Condition / Transition** | B5 (#73) | `queryKeys.routers.detail(id)` | `queryKeys.routers.lists()`, `queryKeys.routers.conditionHistory(id)`, `queryKeys.routers.statusHistory(id)` |
| **IP Reserve / Release / Archive / Unarchive** | B6 (#74) | `queryKeys.ipAddresses.all` | `queryKeys.ipAddresses.history(id)` |
| **Employee Update / Status Change** | B1 (#69) | `queryKeys.employees.all` | `queryKeys.attendance.all` |
| **Report Generation / CSV Import** | A9 (#68) | `queryKeys.jobs.status(id)` | Respective domain list upon job completion |

---

## 3. Typed Container / Component Seam

To maintain separation of concerns and enable isolated UI testing:

1. **Containers (`*Container.tsx` or Page Components)**:
   - Own all network calls, React Query hooks (`useQuery`, `useMutation`), URL search params, and cache invalidations.
   - Unwrap API payloads with `unwrap()` and normalize pagination with `normalizePaginatedResponse()`.
   - Pass typed domain objects and action callbacks to presentational components.

2. **Presentational Components (`*View.tsx`, `*Table.tsx`, `*Form.tsx`)**:
   - Zero direct imports of `axios`, `api`, or `useQuery`.
   - Pure UI receiving strongly-typed props from `@alfahd/types` / `@/core/api/types`.
   - Emit user intent via typed callbacks (`onSelect`, `onSubmit`, `onFilterChange`).

---

## 4. Shared-File Ownership & Parallel Collision Prevention

To prevent merge conflicts across parallel feature branches:

| Shared File | Sole Author / Owner | Consumer Rules |
| :--- | :--- | :--- |
| `packages/types/src/index.ts` | **Task A3 (#67)** | Run `pnpm types:build` before building/testing consumers. Additive types only. |
| `apps/web/src/core/api/endpoints.ts` | **Task A3 (#67)** | Stable contract. Contains canonical routes. Do not hand-edit routes without issue alignment. |
| `apps/web/src/core/api/types.ts` | **Task A3 (#67)** | Exports `PaginatedResult<T>` and re-exports `@alfahd/types`. |
| `apps/web/src/core/api/pagination.ts` | **Task A3 (#67)** | Universal normalizer for all pagination shapes. |
| `apps/web/src/core/api/axios-instance.ts` | **Task A3 (#67)** | Shared client with 401 refresh lock, relative `/api` base, and FormData support. |
| `apps/web/src/core/query/query-keys.ts` | **Task A3 (#67)** | Pre-defined factories for all 8 domains. Tasks B1–B7 consume these directly. |
| `apps/web/src/core/query/use-report-jobs.ts` | **Task A9 (#68)** | High-level domain hooks for Attendance, Router reports, and IP CSV imports. |
| `apps/web/src/components/shared/jobs/` | **Task A9 (#68)** | Unified modal dialog for BullMQ job progress and file downloads. |
| `apps/web/src/features/*` | **Tasks B1–B7** | Isolated per-domain directories to prevent cross-task collisions. |

---

## 5. Async Reports & Job Polling Hooks (Task A9 / Issue #68)

Feature pages do not need to manage raw WebSocket or HTTP polling loops. Pre-built domain hooks in [`use-report-jobs.ts`](./use-report-jobs.ts) manage the background lifecycle and binary downloads:

### Domain Hook Cheat Sheet

| Feature Domain | Hook | Trigger Function | Purpose |
| :--- | :--- | :--- | :--- |
| **F2 (Attendance / Employees)** | `useAttendanceReport()` | `generateReport(query)` | Enqueues BullMQ attendance report, polls until `COMPLETED`, provides `download()`. |
| **F5 (Routers)** | `useRouterExport()` | `exportRouters(dto)` | Enqueues router inventory export, polls, provides `download()`. |
| **F6 (IP Management)** | `useIpImport()` | `importFile(file)` | Uploads CSV, polls backend import worker, returns `{ inserted, skipped, errors }`. |

### Minimal Wiring Example (F2 Attendance Report)

```tsx
import { useAttendanceReport } from "@/core/query/use-report-jobs";
import { Button } from "@/components/ui/button";

export function ExportAttendanceButton({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { generateReport, download, isGenerating, isCompleted } = useAttendanceReport();

  return (
    <Button
      onClick={isCompleted ? () => download() : () => generateReport({ startDate, endDate })}
      disabled={isGenerating}
    >
      {isGenerating ? "Generating..." : isCompleted ? "Download File" : "Export Report"}
    </Button>
  );
}
```

For full modal dialog integration with automatic progress bars, see [`components/shared/jobs/README.md`](../../components/shared/jobs/README.md).

---

## 6. Employee & Technician Selector Lookup Hooks (Task B1 / Issue #69)

Warehouse staff are permitted to assign routers and dispatch inventory, but `GET /employees` is strictly `ADMIN`-only and returns sensitive HR PII.

To populate technician dropdowns and employee selectors safely, use the minimal lookup hooks in [`use-employee-lookup.ts`](./use-employee-lookup.ts). These call `GET /employees/lookup` (accessible by both `ADMIN` and `WAREHOUSE_STAFF`), projecting **zero PII** (`id`, `name`, `role`, `status`, `isEligible`, `assignedWarehouseId`).

### Hooks

| Hook | Parameters | Returns | Ideal For |
| :--- | :--- | :--- | :--- |
| `useTechniciansLookup(warehouseId?)` | Optional `warehouseId` filter | `{ technicians, isLoading, error }` | Router assignment dropdowns, Outbound stock dispatch forms. Only returns `ACTIVE` technicians with `isEligible: true`. |
| `useEmployeeLookup(params?)` | `{ role, warehouse_id, status, q, limit }` | `{ employees, isLoading, error }` | General employee selectors across any department or status. |

### Minimal Dropdown Wiring Example (Router Assignment)

```tsx
import { useTechniciansLookup } from "@/core/query/use-employee-lookup";

export function TechnicianSelect({
  value,
  onChange,
  warehouseId,
}: {
  value: string;
  onChange: (id: string) => void;
  warehouseId?: string;
}) {
  const { technicians, isLoading } = useTechniciansLookup(warehouseId);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">{isLoading ? "Loading technicians..." : "Select a technician"}</option>
      {technicians.map((tech) => (
        <option key={tech.id} value={tech.id}>
          {tech.name}
        </option>
      ))}
    </select>
  );
}
```

---

## 7. Warehouses & Product Catalog Hooks (Task B2 / Issue #70)

The real data layer for Warehouses and Products integrates with backend endpoints `/warehouses`, `/products`, `/inventory/warehouses/:id`, and `/inventory/movements`.

### Warehouse Hooks ([`use-warehouses.ts`](./use-warehouses.ts))

| Hook | Description | Cache Invalidation |
| :--- | :--- | :--- |
| `useWarehouses(params?)` | Fetches paginated warehouses list | `warehousesKeys.list(params)` |
| `useWarehouse(id)` | Fetches single warehouse details | `warehousesKeys.detail(id)` |
| `useCreateWarehouse()` | Creates warehouse (`CreateWarehouseDto`) | `warehouses.all`, `inventory.all` |
| `useUpdateWarehouse()` | Updates warehouse (`UpdateWarehouseDto`) | `warehouses.all`, `warehouses.detail(id)`, `inventory.all` |
| `useDeleteWarehouse()` | Soft-deactivates warehouse with 409 conflict detection | `warehouses.all`, `inventory.all` |
| `useWarehouseStaff(id)` | Resolves staff via `/employees/lookup?warehouse_id=...` | Delegated to `employeesKeys.lookup` |
| `useWarehouseStock(id)` | Fetches warehouse inventory balances | `warehousesKeys.stock(id)` |
| `useWarehouseMovements(id, role)` | Fetches movement history (Least-privilege scoped: only runs for `ADMIN` and `WAREHOUSE_STAFF`) | `inventoryKeys.movements` |

### Product Hooks ([`use-products.ts`](./use-products.ts))

| Hook | Description | Cache Invalidation |
| :--- | :--- | :--- |
| `useProducts(params?)` | Fetches paginated product catalog | `productsKeys.list(params)` |
| `useProduct(id)` | Fetches product by ID | `productsKeys.detail(id)` |
| `useCreateProduct()` | Adds product with uppercase SKU normalization | `products.all`, `inventory.all` |
| `useUpdateProduct()` | Updates catalog details and low stock threshold | `products.all`, `products.detail(id)`, `inventory.all` |

---

## 8. Real Inventory Balances & Multi-Movement Operations (Task B3 / Issue #71)

The real data layer for Inventory balances and multi-movement stock operations integrates with `/inventory`, `/inventory/warehouses/:id`, and the 5 canonical mutation endpoints: `/inventory/inbound`, `/inventory/outbound`, `/inventory/returns`, `/inventory/transfer`, and `/inventory/adjust`.

### Inventory Hooks ([`use-inventory.ts`](./use-inventory.ts))

| Hook | Type | Description | Permissions & Scoping | Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| `useInventoryStock(params?)` | Query | Global stock balances across all warehouses | All authenticated roles | `inventoryKeys.balances` |
| `useWarehouseInventoryStock(id, params?)` | Query | Stock balances for a specific warehouse | All authenticated roles | `inventoryKeys.warehouseStock(id)` |
| `useInventoryMovements(params?, role)` | Query | Audit movement log | Least-privilege: enabled only for `ADMIN` & `WAREHOUSE_STAFF` (`isForbidden: true` for `CS`/`TECHNICIAN`) | `inventoryKeys.movements` |
| `useRecordInbound()` | Mutation | Supplier stock receipt (`InboundStockDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `inventory.all`, `warehouses.all`, `products.all` |
| `useRecordOutbound()` | Mutation | Technician stock issue (`OutboundStockDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `inventory.all`, `warehouses.all`, `products.all` |
| `useRecordReturn()` | Mutation | Technician stock return (`ReturnStockDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `inventory.all`, `warehouses.all`, `products.all` |
| `useTransferStock()` | Mutation | Inter-warehouse transfer (`TransferStockDto`) | `ADMIN`, `WAREHOUSE_STAFF` (enforces `fromWarehouseId !== toWarehouseId`) | `inventory.all`, `warehouses.all`, `products.all` |
| `useAdjustStock()` | Mutation | Inventory count adjustment (`AdjustStockDto`) | **Strictly `ADMIN` only** (requires `newQuantity` and mandatory `notes`) | `inventory.all`, `warehouses.all`, `products.all` |

### Key Architectural Guardrails
1. **Serialization Guardrail (`isSerialized`)**:
   Quantity-only movements against serialized items (e.g. routers) are rejected by the API with 400 Bad Request. The UI checks `product.isSerialized === true` directly from catalog metadata and renders an Arabic warning routing to `/routers-preview`, disabling the movement form.
2. **Server-Derived Audit Attribution**:
   The `responsibleUserId` audit actor is strictly derived on the backend from the JWT session. No user selection input is exposed in forms.
3. **Cross-Module Invalidation**:
   Every stock mutation modifies inventory counts, warehouse stock summaries, and product catalog low-stock statuses, triggering invalidations across `inventory.all`, `warehouses.all`, and `products.all`.

---

## 9. Real Router Lifecycle, Transitions & Triple Audit Histories (Tasks B4 & B5 / Issues #72 & #73)

The real data layer for Router asset management integrates with `/routers`, `/routers/:id`, `/routers/:id/assign`, `/routers/:id/transition`, and `/routers/:id/condition`, plus triple audit history routes (`/assignments`, `/condition-history`, `/status-history`).

### Router Hooks ([`use-routers.ts`](./use-routers.ts))

| Hook | Type | Description | Permissions & Scoping | Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| `useRouters(params?)` | Query | Paginated routers with status, condition, warehouse, and serial filtering | All authenticated roles (`ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECH`) | `routersKeys.list(params)` |
| `useRouter(id)` | Query | Single router details with active custody | All authenticated roles | `routersKeys.detail(id)` |
| `useCreateRouter()` | Mutation | Registers physical router asset (`CreateRouterDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `routers.all`, `warehouses.all`, `inventory.all`, `products.all` |
| `useAssignRouter()` | Mutation | Hands custody over to technician (`AssignRouterDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `routers.all`, `routers.detail(id)`, `warehouses.all`, `inventory.all` |
| `useTransitionRouter()` | Mutation | Transitions lifecycle status along whitelist (`TransitionRouterDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `routers.all`, `routers.detail(id)`, `routers.statusHistory(id)`, `routers.assignmentHistory(id)`, `warehouses.all`, `inventory.all` |
| `useUpdateRouterCondition()` | Mutation | Updates physical condition/repair location (`UpdateRouterConditionDto`) | `ADMIN`, `WAREHOUSE_STAFF` | `routers.all`, `routers.detail(id)`, `routers.conditionHistory(id)`, `routers.assignmentHistory(id)`, `warehouses.all`, `inventory.all` |
| `useRouterAssignments(id)` | Query | Chronological custody history for a router | `ADMIN`, `WAREHOUSE_STAFF` | `routers.assignmentHistory(id)` |
| `useRouterConditionHistory(id)` | Query | Hardware condition change audit history | `ADMIN`, `WAREHOUSE_STAFF` | `routers.conditionHistory(id)` |
| `useRouterStatusHistory(id)` | Query | Lifecycle transition audit history | `ADMIN`, `WAREHOUSE_STAFF` | `routers.statusHistory(id)` |

### Key Architectural Invariants
1. **8-Status Lifecycle vs 3 Physical Conditions**:
   - Statuses: `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, `DECOMMISSIONED`.
   - Physical Conditions: `SERVICEABLE`, `DAMAGED`, `UNDER_REPAIR`.
   - A router is assignable to a technician **only** when `status === 'AVAILABLE'` AND `physicalCondition === 'SERVICEABLE'` AND placed in an active warehouse (`warehouseId !== null`).
2. **Strict Transition Whitelist (`ALLOWED_ROUTER_TRANSITIONS`)**:
   - Transitions strictly follow the canonical state machine exported from `@alfahd/types`.
   - `ASSIGNED_TO_TECHNICIAN` transition redirects to the technician assignment modal (`POST /routers/:id/assign`).
   - `INSTALLED_AT_CUSTOMER` transition is gated until customer custody targets and tickets (M3a) are supported.
   - Terminal states (`LOST`, `DECOMMISSIONED`) prohibit any transitions or condition updates.
3. **Mandatory Operational Reasons**:
   - Transitions and condition/location updates strictly require non-empty reasons ($\ge 3$ characters).
4. **Dual Onboarding Modes (`isNewReceipt`)**:
   - `isNewReceipt: true`: Inbound delivery from supplier, increments warehouse inventory stock (+1 `INBOUND_SUPPLIER`).
   - `isNewReceipt: false`: Existing unbarcoded warehouse inventory onboarding (+0 delta). Enforces capacity: $\text{usableCount} < \text{currentStock}$. Throws `409 Conflict` if capacity exhausted.
   - Damaged opening unit (`isNewReceipt: false` + `DAMAGED`): Deducts 1 opening unit via `ADJUSTMENT` movement and writes audit log in `router_condition_history`.
5. **Zero Generic PATCH**:
   - Routers are never updated via generic property mutation; they strictly use dedicated endpoints for assignments, transitions, and condition changes.

---

## 10. Real IP Address Management, Lifecycle Transitions & RBAC Mirroring (Task B6 / Issue #74)

The real data layer for IP Address Management integrates with `/ip-addresses`, `/ip-addresses/:id`, `/ip-addresses/:id/reserve`, `/ip-addresses/:id/release`, `/ip-addresses/:id/archive`, `/ip-addresses/:id/unarchive`, and `/ip-addresses/:id/history`, plus async BullMQ CSV import via `/ip-addresses/import`.

### IP Management Hooks ([`use-ip-addresses.ts`](./use-ip-addresses.ts))

| Hook | Type | Description | Permissions & Scoping | Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| `useIpAddresses(params?)` | Query | Paginated IPv4 addresses with status, isArchived, and search filters | `ADMIN`, `TECHNICIAN` (`CS` & `WAREHOUSE_STAFF` 403 Forbidden) | `ipAddressesKeys.list(params)` |
| `useIpAddress(id)` | Query | Single IP address details | `ADMIN`, `TECHNICIAN` | `ipAddressesKeys.detail(id)` |
| `useCreateIpAddress()` | Mutation | Registers a new individual IPv4 address in `FREE` status (`CreateIpDto`) | **Strictly `ADMIN` only** | `ipAddresses.all` |
| `useUpdateIpAddress()` | Mutation | Updates metadata notes on an IP address (`UpdateIpDto`) | **Strictly `ADMIN` only** | `ipAddresses.all`, `ipAddresses.detail(id)`, `ipAddresses.history(id)` |
| `useReserveIpAddress()` | Mutation | Manually reserves an available `FREE` IP address | **Strictly `ADMIN` only** | `ipAddresses.all`, `ipAddresses.detail(id)`, `ipAddresses.history(id)` |
| `useReleaseIpAddress()` | Mutation | Releases a `RESERVED` IP address back to `FREE` | **Strictly `ADMIN` only** | `ipAddresses.all`, `ipAddresses.detail(id)`, `ipAddresses.history(id)` |
| `useArchiveIpAddress()` | Mutation | Archives a `FREE` IP address (blocks allocation) | **Strictly `ADMIN` only** | `ipAddresses.all`, `ipAddresses.detail(id)`, `ipAddresses.history(id)` |
| `useUnarchiveIpAddress()` | Mutation | Restores an archived IP address back to the active pool | **Strictly `ADMIN` only** | `ipAddresses.all`, `ipAddresses.detail(id)`, `ipAddresses.history(id)` |
| `useIpHistory(id)` | Query | Full chronological audit ledger for an IP address | **Strictly `ADMIN` only** (Technician UI never requests history) | `ipAddresses.history(id)` |

### Key Architectural Invariants
1. **Authoritative Two-Status Model & Separate Archive Toggle**:
   - Domain statuses are strictly `FREE` and `RESERVED` (`@alfahd/types`).
   - Archiving is represented by an independent `isArchived: boolean` column, never mixed into a pseudo-status.
2. **Archiving Invariant (Cannot Archive RESERVED IPs)**:
   - An IP in `RESERVED` status cannot be archived directly (must be released to `FREE` first; backend returns 409 Conflict).
   - The UI disables the archive button on reserved addresses and shows an explanatory tooltip.
3. **Defensive IPv4 Validation**:
   - Accepts individual IPv4 hosts only (`192.168.1.50`).
   - Client-side validation strictly rejects CIDR prefixes (`/24`), IPv6 addresses (`:`), non-numeric octets, and values $> 255$.
   - Form state is defensively retained on `409 Conflict` duplicate IP errors.
4. **Action-Specific RBAC Mirroring**:
   - `ADMIN`: Full authority (create, edit notes, reserve, release, archive, unarchive, view history, CSV import).
   - `TECHNICIAN`: Read-only access to lists and details. Technician UI never renders mutation buttons or requests `GET /ip-addresses/:id/history`.
   - `CS` & `WAREHOUSE_STAFF`: Denied access to IP management (`403 Forbidden`).
5. **Task A9 CSV Import Seam**:
   - Integrates `useIpImport()` and `CsvDropzone` for asynchronous BullMQ bulk import with real-time job progress and line-numbered inserted/skipped/error summaries.
6. **Zero Generic Status Updates / No Hidden Hard Delete**:
   - All status transitions use discrete lifecycle endpoints; IPs are archived, never deleted.

---

## 11. Product Soft Deactivation Semantics & No-Hard-Delete Compliance (Task B7 / Issue #77)

The real data layer for Products enforces global No-Hard-Delete Compliance (`PLAN.md`). Physical deletion (`DELETE FROM products`) is strictly eliminated across the system. Instead, `DELETE /products/:id` performs soft deactivation (`is_active = false`), preserving product/SKU identity, stock movement audit trails, warehouse balance relations, and router hardware associations.

### Product Deactivation Hooks ([`use-products.ts`](./use-products.ts))

| Hook | Type | Description | Permissions & Scoping | Cache Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| `useProducts(params?)` | Query | Paginated catalog with `search`, `category`, and `activeOnly` filters | `ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECHNICIAN` | `productsKeys.list(params)` |
| `useProduct(id)` | Query | Single product details including aggregate stock | All authenticated roles | `productsKeys.detail(id)` |
| `useCreateProduct()` | Mutation | Registers a new product with uppercase SKU normalization | `ADMIN`, `WAREHOUSE_STAFF` | `products.all`, `inventory.all` |
| `useUpdateProduct()` | Mutation | Updates metadata (name, model, category, lowStockThreshold, SKU) | `ADMIN`, `WAREHOUSE_STAFF` | `products.all`, `products.detail(id)`, `inventory.all` |
| `useDeleteProduct()` | Mutation | **Soft-deactivates / archives** a product (`is_active = false`) | **Strictly `ADMIN` only** | `products.all`, `products.detail(id)`, `inventory.all` |

### Key Architectural Invariants & Safeguards
1. **No-Hard-Delete Law**:
   - `DELETE /products/:id` strictly maps to `softDeactivate(id)` (`UPDATE products SET is_active = false, updated_at = NOW()`).
   - The UI never renders a "حذف صنف" (hard delete) action; it only presents "تعطيل وأرشفة الصنف" (soft deactivation/archive) to Admin users.
2. **Strict 409 Conflict Safeguards**:
   - **Active Inventory Stock**: If active warehouse stock exists ($\sum \text{quantity} > 0$), deactivation is rejected with `409 Conflict` (`"Cannot deactivate product holding active inventory (${currentStock} units in stock)"`).
   - **Active Router Hardware Assets**: If any serialized router assets remain active (`AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `UNDER_REPAIR`), deactivation is rejected with `409 Conflict` (`"Cannot deactivate product with active router hardware assets (${activeRouters} units active)"`).
   - **Movement History Invariant**: Historical `stock_movements` logs do **not** block soft deactivation, preserving audit trails without trapping obsolete SKUs.
3. **Read & Selector Behavior**:
   - Inbound delivery and stock movement selectors filter out inactive products (`item.isActive !== false`) so deactivated items cannot receive new stock.
   - Catalog tables display an explicit badge: `نشط` (emerald) vs `معطّل / مؤرشف` (amber).
   - Inactive products retain full visibility in historical movement logs and audit views.






