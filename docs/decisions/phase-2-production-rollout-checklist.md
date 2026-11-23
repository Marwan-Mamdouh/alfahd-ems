# Phase 2 Production Rollout Checklist & Integration Dispositions (Issue #88 / F7)

**Document Reference:** `docs/decisions/phase-2-production-rollout-checklist.md`  
**Governing Issue:** [#88](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/88) — [Phase 2][F7] Promote production navigation and finish action-level UI permissions  
**Author:** @bahaashahin (Frontend Owner)  
**Audience:** @Marwan-Mamdouh (Project Lead / Handoff Partner), @Hamadaae (Supply Reviewer)  
**Status:** Rollout Decision & Tracking Checklist  

---

## 1. Existing Approved & Active Routes

- [x] `/dashboard` — Dashboard Overview (M1 baseline connected, requires `dashboard.view` [`ADMIN`]).
- [x] `/employees` — User / Employee baseline route (Active on `master`, serves `GET /users`, requires `employees.manage` [`ADMIN`]).
- [x] `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` — Public authentication and password reset flows.

---

## 2. Modules Awaiting Unmerged UI Pull Requests

The following presentational UI implementations have been completed, verified with unit/component test suites, and delivered as Draft PRs by @bahaashahin:

- [ ] **PR #108 (Issue #82):** Employee management components, profile details, status change dialogs, and photo upload.
- [ ] **PR #113 (Issue #83):** Attendance management UI, cross-page totals, history list, and admin override dialogs.
- [ ] **PR #114 (Issue #84):** Warehouse detail components, manager & capacity metrics, staff & stock tabs.
- [ ] **PR #115 (Issue #85):** Product catalog, 5 inventory movement workflows, and soft-deactivation dialog.
- [ ] **PR #116 (Issue #86):** Router asset lifecycle, 4-dimension detail view, triple audit ledger, and async BullMQ report controls.
- [ ] **PR #107 (Issue #87):** IPv4 pool management table, CSV import preview dialog, and reservation controls.

---

## 3. Modules Awaiting Backend-Owned Network Containers

As defined in the Phase 2 Working Agreement (`docs/contracts/phase-2-handoff.md`), backend developers own API client integration, React Query hooks, and page-level container composition. The following production pages must be mounted by backend owners before preview retirement:

- [ ] `/attendance/page.tsx` — Compose `AttendanceTable`, `AttendanceHistoryList`, and `AttendanceOverrideDialog` with `useAttendanceList` / `useAttendanceReport` hooks.
- [ ] `/warehouses/page.tsx` — Promote container from `warehouses-preview/page.tsx` using `useWarehouses`.
- [ ] `/inventory/page.tsx` — Promote container from `inventory-preview/page.tsx` using `useProducts` and `useInventoryStock`.
- [ ] `/routers/page.tsx` — Promote container from `routers-preview/page.tsx` using `useRouters`.
- [ ] `/ip-management/page.tsx` — Promote container from `ip-preview/page.tsx` using `useIpAddresses`.

---

## 4. Role & Action Permission Matrix (Summary)

| Role | Permitted Production Views | Permitted Actions | Strictly Denied Actions & Views |
| :--- | :--- | :--- | :--- |
| **ADMIN** | All production routes (`/dashboard`, `/employees`, `/attendance`, `/warehouses`, `/inventory`, `/routers`, `/ip-management`) | All creates, updates, status overrides, deactivations, stock adjustments, imports, and report exports. | None (Superuser governance). |
| **WAREHOUSE_STAFF** | `/warehouses`, `/inventory`, `/routers`, `/employees/lookup` | Create/update products, record inventory movements (inbound, outbound, returns, transfer), router onboarding, router assignment, condition & lifecycle transitions. | Stock adjustments (`/inventory/adjust`), warehouse deactivation, product deactivation, IPv4 views/actions (DENIED), employee management (DENIED), attendance overrides (DENIED). |
| **CS (Customer Service)** | `/warehouses`, `/inventory` (view-only), `/routers` (view-only), `/customers`, `/tickets` | Read warehouses, read product catalog & stock levels, read router list & details. | All inventory movements, stock adjustments, router assignment/transitions, IPv4 views/actions (DENIED), employee management (DENIED). |
| **TECHNICIAN** | `/ip-management` (READ-ONLY), `/routers` (view-only), `/products` (view-only), attendance check-in/out. | Read IP pool, read routers, read products, mobile attendance check-in/out. | IPv4 create/edit/reserve/import (DENIED), router assignment/mutations (DENIED), warehouse/inventory management (DENIED), employee management (DENIED). |

---

## 5. Final X1 / #89 Browser Acceptance Preconditions

The final end-to-end acceptance ticket (#89 / X1) requires:
1. Merge of PRs #107, #108, #113, #114, #115, #116 into `master`.
2. Mounting of production route containers (`/attendance`, `/warehouses`, `/inventory`, `/routers`, `/ip-management`).
3. Switching `comingSoon: false` on the corresponding items in `nav-config.ts`.
4. Browser verification against live PostgreSQL and Redis services.
5. Retirement or safe redirection of preview URLs.

---

## 6. Explicit Scope Limitations & Deferred Routes

The following capabilities are explicitly deferred and must NOT be enabled in Phase 2 navigation:
- **Live Field Tracking (`/tracking`):** Postponed to future tracking epic.
- **Customer / CRM (`/customers`):** Postponed to CRM release.
- **Ticket Core System (`/tickets`):** Governed separately under M3a epic (#66 / #90).
- **Technician Work Orders (`/technicians`):** Postponed to field operations release.
- **Standalone Reports Center (`/reports`):** Module reports are embedded directly inside their respective pages (e.g. attendance, routers).
