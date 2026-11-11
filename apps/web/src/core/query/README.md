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



