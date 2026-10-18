# Implementation Plan: Milestone M2a — HR & Attendance

**Branch**: `feat/m2a-hr-attendance` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

---

## Summary

Implement Milestone M2a as locked by `PLAN.md`:
1. Employee profile management extending `users` with `department` (`as const` tuple / `pgEnum`), `ON_LEAVE` status, contact info, national ID, hire date, warehouse assignment, and Cloudinary profile photo.
2. GPS-geofenced attendance check-in (server-calculated Haversine distance <= 150m from home warehouse, evaluation of `LATE` vs `ON_TIME` cutoff in `Africa/Cairo`) and check-out (from anywhere, no GPS).
3. Attendance adjustment by Admin with mandatory reason auditing.
4. Asynchronous Excel report pipeline (`exceljs` + BullMQ + Cloudinary) exposing `GET /attendance/report` and `GET /jobs/:id`.
5. Cloudinary `StorageService` interface with production adapter and `FakeStorageService` for automated tests.

---

## Technical Context

**Language/Version**: Node.js ≥ 22.12 LTS, TypeScript 5.x, ESM (`"type": "module"`).  
**Framework**: NestJS 12 (SWC compiler).  
**Database**: PostgreSQL 16 via Drizzle ORM + drizzle-kit migrations.  
**Storage**: Cloudinary SDK (stores `public_id` in `profile_photo_key`, generates responsive URLs).  
**Queue & Caching**: Redis 7 + BullMQ (`reports` queue, ioredis).  
**Spreadsheet Generation**: `exceljs` generating formatted `.xlsx` streams with RTL / UTF-8 fonts.  
**Validation**: `class-validator`, `class-transformer`, file buffer magic bytes validation.  
**Timezone**: `Africa/Cairo` with Egypt Daylight Saving Time (DST).  
**Enum Policy**: **Zero TypeScript enums**. The `enum` keyword is strictly prohibited across the entire monorepo. All domain sets are authored as `as const` arrays and derived union types in `@alfahd/types`; Drizzle `pgEnum`s are instantiated directly from those arrays.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Shared Contracts First | `packages/types` defines `Department`, `UserStatus`, `AttendanceStatus` as `as const` tuples before API imports | ✅ PASS |
| II. ESM + Drizzle Stack | ESM relative imports carry explicit `.js` extension; Drizzle ORM used; no Prisma | ✅ PASS |
| III. Strict Quality Gates | Pre-commit hook chain (types build → typecheck → format → lint → tests) passes | ✅ PASS |
| IV. Soft-Delete Everywhere | No hard delete exists for employees or attendance; `INACTIVE` status deactivates | ✅ PASS |
| V. Split Deployment | Monorepo structure preserved; staging deploy deferred to deploy gate | ✅ PASS |
| VI. Zero TypeScript Enums | **`enum` keyword strictly forbidden**. All value sets defined as `as const` arrays in `packages/types` (`DEPARTMENTS`, `USER_STATUSES`, `ATTENDANCE_STATUSES`) and derived union types + Drizzle `pgEnum` | ✅ PASS |
| Storage Rule | Cloudinary SDK used, stores `public_id`, mock fake for tests | ✅ PASS |
| Report Pipeline Rule | BullMQ background queue used; no synchronous blocking reports | ✅ PASS |
| No Generic Repositories | Services call Drizzle directly; no speculative repository layers | ✅ PASS |

**No gate violations.**

---

## Project Structure

### Documentation (this feature)
```text
specs/005-m2a-hr-attendance/
├── spec.md                       ← Feature specification
├── checklists/
│   └── requirements.md           ← Quality validation checklist
├── plan.md                       ← Implementation plan (this file)
├── research.md                   ← Phase 0: Algorithms & integrations
├── data-model.md                 ← Phase 1: Entity schemas & ERD
├── quickstart.md                 ← Phase 1: Verification guide
├── contracts/
│   └── api-contracts.md          ← Phase 1: OpenAPI wire contracts
└── tasks.md                      ← Phase 2: Actionable task list
```

### Source Code Changes
```text
packages/types/
└── src/
    └── index.ts                  ← Department, UserStatus (ON_LEAVE), AttendanceStatus tuples

apps/api/
├── src/
│   ├── common/
│   │   ├── services/
│   │   │   └── clock.service.ts  ← Timezone & instant clock injection
│   │   └── utils/
│   │       ├── geo.utils.ts      ← Haversine formula pure function
│   │       └── file.utils.ts     ← Magic bytes validator (JPEG/PNG)
│   ├── database/
│   │   └── schema/
│   │       ├── index.ts          ← users extended, attendance_records added
│   │       └── mappers.ts
│   ├── storage/
│   │   ├── storage.interface.ts  ← StorageService interface
│   │   ├── cloudinary.service.ts ← Real Cloudinary adapter
│   │   ├── fake-storage.service.ts ← In-memory mock for tests
│   │   └── storage.module.ts
│   ├── jobs/
│   │   ├── jobs.controller.ts    ← GET /jobs/:id
│   │   ├── jobs.service.ts       ← BullMQ job reader
│   │   └── jobs.module.ts
│   ├── employees/
│   │   ├── dto/                  ← CreateEmployeeDto, UpdateEmployeeDto, etc.
│   │   ├── employees.controller.ts ← /employees CRUD
│   │   ├── employees.service.ts  ← Reuses UsersService
│   │   └── employees.module.ts
│   ├── attendance/
│   │   ├── dto/                  ← CheckInDto, OverrideAttendanceDto, etc.
│   │   ├── attendance.controller.ts ← /attendance check-in/out, overrides, report
│   │   ├── attendance.service.ts    ← Geofence & cutoff logic
│   │   ├── attendance.worker.ts     ← BullMQ report job processor
│   │   └── attendance.module.ts
│   └── app.module.ts
└── drizzle/
    └── 0002_m2a_hr_attendance.sql ← Drizzle migration on top of M1
```

---

## Phase 0: Research (Completed)
Detailed in [research.md](./research.md):
- Haversine geofence calculation.
- Daylight saving timezone day boundary calculation in `Africa/Cairo`.
- Magic bytes file validation (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`).
- BullMQ asynchronous report worker & `exceljs` document generation.

---

## Phase 1: Design & Contracts (Completed)
Detailed in:
- [data-model.md](./data-model.md)
- [contracts/api-contracts.md](./contracts/api-contracts.md)
- [quickstart.md](./quickstart.md)

---

## Phase 2: Implementation Sequencing
1. **Types & Shared Contracts (Zero TS Enums)**: Update `packages/types` with value sets strictly defined as `as const` arrays (`DEPARTMENTS`, `USER_STATUSES` including `ON_LEAVE`, `ATTENDANCE_STATUSES`) and derived union types. Absolutely no TypeScript `enum` declarations.
2. **Database Schema & Migration**: Update `apps/api/src/database/schema/index.ts` (passing the `as const` arrays directly to Drizzle `pgEnum`) and generate clean migration applying over M1 without data loss.
3. **Core Utilities**: Implement `ClockService`, `haversineDistanceMeters`, and magic bytes file checker.
4. **Storage Module**: Create `StorageService` interface, Cloudinary implementation, and `FakeStorageService`.
5. **Report & Job Pipeline**: Configure BullMQ queue `reports`, worker, and `GET /jobs/:id`.
6. **Employees Module**: Implement `/employees` endpoints reusing `UsersService`, photo upload, and session revocation on `INACTIVE`.
7. **Attendance Module**: Implement `/attendance/check-in`, `/attendance/check-out`, `PATCH /attendance/:id`, and `GET /attendance/report`.
8. **End-to-End & Acceptance Verification**: Run full suite of unit and E2E tests verifying all "Reject if" conditions from `PLAN.md`.
