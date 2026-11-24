# Phase 2 Route Exposure Matrix & Preview Lifecycle (Issue #88 / F7)

**Document Reference:** `docs/contracts/phase-2-route-exposure-matrix.md`  
**Governing Issue:** [#88](https://github.com/Marwan-Mamdouh/alfahd-ems/issues/88) — [Phase 2][F7] Promote production navigation and finish action-level UI permissions  
**Target Baseline:** `origin/master` (Post Phase 2 Frontend Deliveries)  
**Author:** @bahaashahin (Frontend Owner)  
**Status:** Approved Architectural Contract  

---

## 1. Executive Summary

This contract establishes the authoritative exposure rules for all frontend routes across Phase 2 modules. In accordance with Phase 2 governance rules:
- **No Mock Success Paths:** Navigation links must NEVER expose routes backed by mock/fake data or point to non-existent pages (avoiding 404s).
- **Safe Gating:** Modules whose frontend presentational UI is currently unmerged in pending PRs (#107, #108, #113, #114, #115, #116) or awaiting backend-owned network container mounting must remain safely gated via `comingSoon: true` in `nav-config.ts`.
- **Preview Work Preservation:** Existing preview routes (`*-preview`) MUST NOT be deleted, broken, or blindly redirected until their corresponding real production replacements are merged into `master` and verified end-to-end.
- **Action-Level Granularity:** Action-level permissions (`*.view`, `*.manage`, `*.create`, `*.deactivate`, `*.export`, `*.import`) replace coarse `canManage` flags.

---

## 2. Route Exposure Matrix

| Module | Preview Route | Production Route | Real Integration on Master | Required Permission | Safe to Expose Live | Dependency / Blocker |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview** | N/A | `/dashboard` | **Yes** (M1 baseline connected) | `dashboard.view` (`ADMIN`) | **YES** | None |
| **Employee Management** | `/employees-preview` | `/employees` | **Partial** (`/employees` serves M1 `GET /users`; M2 HR UI is in PR #108) | `employees.view` (`ADMIN`) | **YES** (Retains M1 live route) | PR #108 merge + Backend HR container |
| **Attendance Tracking** | `/attendance-preview` | `/attendance` | **No** (Preview uses demo fixtures; Real UI in PR #113) | `attendance.view` (`ADMIN`) | **NO** (Gated via `comingSoon`) | PR #113 merge + Backend network container |
| **Warehouse Management** | `/warehouses-preview` | `/warehouses` | **Partial** (Preview wired to API; Production container in PR #114) | `warehouses.view` (`ADMIN`, `WAREHOUSE_STAFF`, `CS`) | **NO** (Gated via `comingSoon`) | PR #114 merge + Production route mounting |
| **Product & Inventory** | `/inventory-preview` | `/inventory` | **Partial** (Preview wired to API; Production UI in PR #115) | `inventory.view` (`ADMIN`, `WAREHOUSE_STAFF`, `CS`) | **NO** (Gated via `comingSoon`) | PR #115 merge + Production route mounting |
| **Router Asset Lifecycle** | `/routers-preview` | `/routers` | **Partial** (Preview wired to API; Production UI in PR #116) | `routers.view` (`ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECHNICIAN`) | **NO** (Gated via `comingSoon`) | PR #116 merge + Production route mounting |
| **IPv4 Pool Management** | `/ip-preview` | `/ip-management` | **Partial** (Preview wired to API; Production UI in PR #107) | `ips.view` (`ADMIN`, `TECHNICIAN`) | **NO** (Gated via `comingSoon`) | PR #107 merge + Production route mounting |
| **Live Field Tracking** | N/A | `/tracking` | **No** (Explicitly excluded from Phase 2 scope) | `tracking.view` (`ADMIN`) | **NO** (Gated via `comingSoon`) | Future Phase (Out of Scope) |
| **Customer / CRM** | N/A | `/customers` | **No** (Explicitly excluded from Phase 2 scope) | `customers.view` (`ADMIN`, `CS`) | **NO** (Gated via `comingSoon`) | Future Phase (Out of Scope) |
| **Tickets Core** | N/A | `/tickets` | **No** (Explicitly excluded from Phase 2 scope) | `tickets.view` (`ADMIN`, `CS`) | **NO** (Gated via `comingSoon`) | M3a Epic (Out of Scope) |
| **Technician Work Orders**| N/A | `/technicians` | **No** (Explicitly excluded from Phase 2 scope) | `technicians.view` (`ADMIN`) | **NO** (Gated via `comingSoon`) | Future Phase (Out of Scope) |
| **Reports Center** | N/A | `/reports` | **No** (Module reports embedded inside modules) | `reports.view` (`ADMIN`) | **NO** (Gated via `comingSoon`) | Future Phase (Out of Scope) |
| **System Settings** | N/A | `/settings` | **No** (Explicitly excluded from Phase 2 scope) | `settings.manage` (`ADMIN`) | **NO** (Gated via `comingSoon`) | Future Phase (Out of Scope) |

---

## 3. Module Audit & Rationale

### 3.1. Employees
- **Current State:** `/employees` exists on `master`, fetching from `GET /users` (M1 user accounts).
- **PR #108 Status:** Extends employee presentation with full HR profiles, status change logs, and photo uploads. PR #108 is currently pending review.
- **Rollout Decision:** `/employees` remains active and exposed in production navigation. `/employees-preview` is retained as a preview fixture until PR #108 merges and backend mounts the updated HR schema container.

### 3.2. Attendance
- **Current State:** No `/attendance` production page exists on `master`. `/attendance-preview` uses local demo fixtures.
- **PR #113 Status:** Delivers `AttendanceTable`, cross-page totals, history lists, and admin override dialogs.
- **Rollout Decision:** `/attendance` MUST remain `comingSoon: true` in `nav-config.ts`. Exposing it prematurely would trigger a 404. `/attendance-preview` is preserved for verification.

### 3.3. Warehouses
- **Current State:** `/warehouses-preview` exists and is connected to live API hooks (`useWarehouses`, etc.). No `/warehouses` production page exists on `master`.
- **PR #114 Status:** Completes warehouse detail views, manager capacity metrics, and movement logs.
- **Rollout Decision:** Navigation link `/warehouses` is updated to require `warehouses.view` (allowing CS, Warehouse Staff, and Admin visibility), but remains `comingSoon: true` until PR #114 is merged and backend mounts the production container.

### 3.4. Products & Inventory
- **Current State:** `/inventory-preview` connects to live API hooks. No `/inventory` production page exists on `master`.
- **PR #115 Status:** Delivers 5 movement workflows, catalog management, and soft-deactivation dialogs.
- **Rollout Decision:** Navigation link `/inventory` is updated to require `inventory.view`, remaining `comingSoon: true` until PR #115 merges.

### 3.5. Routers
- **Current State:** `/routers-preview` connects to live API hooks. No `/routers` production page exists on `master`.
- **PR #116 Status:** Delivers 4-dimension detail views, triple audit ledger, BullMQ report controls, and onboarding modes.
- **Rollout Decision:** Navigation link `/routers` is updated to require `routers.view`, remaining `comingSoon: true` until PR #116 merges.

### 3.6. IPv4 Addresses
- **Current State:** `/ip-preview` connects to live API hooks. No `/ip-management` production page exists on `master`.
- **PR #107 Status:** Delivers IP pool tables, CSV import dialog, and lifecycle actions.
- **Rollout Decision:** Navigation link `/ip-management` requires `ips.view` (strictly ADMIN and TECHNICIAN, denying CS and WAREHOUSE_STAFF), remaining `comingSoon: true` until PR #107 merges.

---

## 4. Preview Retirement Policy

A preview route `/{name}-preview` may ONLY be retired or redirected when ALL of the following criteria are met:
1. The corresponding feature PR has been merged into `origin/master`.
2. The backend owner has mounted the network-aware production container at `/{name}`.
3. End-to-end browser verification (X1 / #89) confirms real data connectivity, error handling, and authorization guards.
4. An explicit 301/308 redirect or deprecation notice is deployed to ensure bookmarks remain functional.
