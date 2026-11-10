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
| `apps/web/src/features/*` | **Tasks B1–B7** | Isolated per-domain directories to prevent cross-task collisions. |

