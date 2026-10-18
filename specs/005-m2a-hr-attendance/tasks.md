# Tasks: Milestone M2a — HR & Attendance

**Branch**: `feat/m2a-hr-attendance` | **Date**: 2026-10-11  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

---

## Phase 1: Setup & Dependencies

**Purpose**: Ensure all required packages (`cloudinary`, `exceljs`, `multer`, `@types/multer`) are installed and configured.

- [X] T001 Install `cloudinary` and `exceljs` in `apps/api` — run `pnpm --filter @alfahd/api add cloudinary exceljs` from repo root
- [X] T002 Install file upload support types in `apps/api` — run `pnpm --filter @alfahd/api add -D @types/multer` from repo root
- [X] T003 Update `apps/api/src/config/env.validation.ts` to validate `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ATTENDANCE_CUTOFF_TIME` (default `09:00`), `ATTENDANCE_RADIUS_M` (default `150`)

---

## Phase 2: Foundational (Shared Types & Data Layer)

**Purpose**: Update shared contracts in `@alfahd/types` first, then update Drizzle schema and generate migration applying over M1 without data loss.

**⚠️ CRITICAL**: Build `@alfahd/types` immediately after editing before compiling `apps/api`.

- [X] T004 [P] Update `packages/types/src/index.ts` to define `DEPARTMENTS`, `USER_STATUSES`, and `ATTENDANCE_STATUSES` strictly as `as const` arrays and derived union types (`Department`, `UserStatus`, `AttendanceStatus`) — **strictly forbid the TypeScript `enum` keyword anywhere**
- [X] T005 [P] Add employee & attendance request/response DTO interfaces to `packages/types/src/index.ts` (`CreateEmployeeDto`, `UpdateEmployeeDto`, `CheckInRequestDto`, `AttendanceRecordDto`, etc.)
- [X] T006 Build and verify `@alfahd/types` — run `pnpm --filter @alfahd/types build` from repo root (must exit 0)
- [X] T007 Extend `users` table schema in `apps/api/src/database/schema/index.ts` with `phone`, `national_id`, `hire_date`, `profile_photo_key`, `assigned_warehouse_id` (FK to warehouses), and instantiate Drizzle `pgEnum`s directly from `@alfahd/types` `as const` arrays (`DEPARTMENTS`, `USER_STATUSES`) without any TS enum
- [X] T008 Add `attendance_records` table schema in `apps/api/src/database/schema/index.ts` with Drizzle `pgEnum` directly from `ATTENDANCE_STATUSES`, `UNIQUE("user_id", "work_date")`, and GPS coordinate check constraints
- [X] T009 Generate and verify Drizzle migration `0002_m2a_hr_attendance.sql` via `pnpm --filter @alfahd/api db:generate` — ensure existing M1 rows are cleanly preserved with default values and logged mappings for departments
- [X] T010 Run API typecheck to confirm schema compilation — `pnpm --filter @alfahd/api typecheck`

---

## Phase 3: Core Infrastructure & Cross-Cutting Services

**Purpose**: Implement pure utility functions and external service interfaces.

- [X] T011 [P] Implement `haversineDistanceMeters(lat1, lon1, lat2, lon2)` pure function in `apps/api/src/common/utils/geo.utils.ts` and comprehensive unit test in `geo.utils.spec.ts` (asserting 0m, 149m, 150m, 151m, and known geocoordinates)
- [X] T012 [P] Implement `ClockService` and timezone helper functions (`getLocalWorkDate`, `isAfterCutoff`) in `apps/api/src/common/services/clock.service.ts` with unit test `clock.service.spec.ts` verifying `Africa/Cairo` day boundaries and DST behavior
- [X] T013 [P] Implement file magic bytes validator in `apps/api/src/common/utils/file.utils.ts` verifying JPEG (`FF D8 FF`) and PNG (`89 50 4E 47`) buffers with unit tests
- [X] T014 Create `StorageService` interface in `apps/api/src/storage/storage.interface.ts` declaring `uploadFile`, `deleteFile`, `getOptimizedUrl`
- [X] T015 Implement `CloudinaryStorageService` in `apps/api/src/storage/cloudinary.service.ts` and `FakeStorageService` in `apps/api/src/storage/fake-storage.service.ts` for automated test suites
- [X] T016 Register `StorageModule` in `apps/api/src/storage/storage.module.ts`, exporting `StorageService` provider (binding to `FakeStorageService` in test environment)
- [X] T017 Implement BullMQ job querying service and `GET /jobs/:id` in `apps/api/src/jobs/` returning `{ id, status, downloadUrl?, error? }`

---

## Phase 4: User Story 1 — Employee Profile & Account Lifecycle Management

**Goal**: Complete `/employees` management endpoints reusing `UsersService`, photo upload via Cloudinary, and session revocation on deactivation.

- [X] T018 [US1] Create validation DTOs in `apps/api/src/employees/dto/`: `create-employee.dto.ts`, `update-employee.dto.ts`, `update-employee-status.dto.ts`, `employee-query.dto.ts`
- [X] T019 [US1] Extend `UsersService` in `apps/api/src/users/users.service.ts` to support querying and updating extended profile fields (`phone`, `national_id`, `hire_date`, `department`, `warehouse_id`, `status`), enforcing that role `TECHNICIAN` requires a valid `assigned_warehouse_id`
- [X] T020 [US1] Implement `EmployeesService` in `apps/api/src/employees/employees.service.ts` delegating user storage to `UsersService` and handling photo upload/deletion coordination
- [X] T021 [US1] Implement status update with session revocation: `EmployeesService.updateStatus(id, status, reason)` — revoking Redis refresh keys (`rt:{userId}:*`) when `status === 'INACTIVE'`, preserving sessions when `status === 'ON_LEAVE'`
- [X] T022 [US1] Implement photo upload in `EmployeesService`: validates ≤ 5 MB, inspects magic bytes, uploads via `StorageService.uploadFile`, updates `profile_photo_key`, deletes the previous Cloudinary asset upon replacement, and rolls back uploaded file if DB write fails
- [X] T023 [US1] Implement `EmployeesController` in `apps/api/src/employees/employees.controller.ts` with endpoints:
  - `POST /employees` (`ADMIN`)
  - `GET /employees` (`ADMIN`, composable filters `role`, `department`, `status`, `warehouse_id`, `q`, paginated)
  - `GET /employees/:id` (`ADMIN` or self)
  - `PATCH /employees/:id` (`ADMIN`)
  - `PATCH /employees/:id/status` (`ADMIN`)
  - `POST /employees/:id/photo` (`ADMIN`, multipart upload)
- [X] T024 [US1] Wire `EmployeesModule` into `apps/api/src/app.module.ts`
- [X] T025 [US1] Write unit tests `employees.service.spec.ts` covering validation rules, technician warehouse requirement, photo upload rollback, and session revocation

---

## Phase 5: User Story 2 — GPS-Geofenced Attendance Check-In & Check-Out

**Goal**: Complete `/attendance/check-in` and `/attendance/check-out` endpoints enforcing §7d rules.

- [X] T026 [US2] Create validation DTOs in `apps/api/src/attendance/dto/`: `check-in.dto.ts` (`lat`, `lng`), `attendance-query.dto.ts`
- [X] T027 [US2] Implement `AttendanceService.checkIn(userId, lat, lng)` in `apps/api/src/attendance/attendance.service.ts`:
  - Fetch user and verify role is `TECHNICIAN` and status is `ACTIVE`
  - Verify user has `assigned_warehouse_id`, else throw 409 `NO_ASSIGNED_WAREHOUSE`
  - Fetch warehouse GPS coordinates
  - Compute Haversine distance server-side; if > 150m, throw 400 `OUT_OF_RANGE` with measured distance in error details
  - Compute `work_date` in `APP_TIMEZONE` (`Africa/Cairo`)
  - Check database unique constraint for existing record today; if exists, throw 409 `ALREADY_CHECKED_IN`
  - Determine `status`: `LATE` if `check_in_at` local time > `ATTENDANCE_CUTOFF_TIME` (09:00), else `ON_TIME`
  - Insert record into `attendance_records`
- [X] T028 [US2] Implement `AttendanceService.checkOut(userId)` in `apps/api/src/attendance/attendance.service.ts`:
  - Verify open check-in exists today (`check_out_at IS NULL`)
  - Update `check_out_at = now()` without any GPS check
  - Return updated record with computed working hours
- [X] T029 [US2] Implement `AttendanceController` endpoints in `apps/api/src/attendance/attendance.controller.ts`:
  - `POST /attendance/check-in` (`TECHNICIAN`)
  - `POST /attendance/check-out` (`TECHNICIAN`)
- [X] T030 [US2] Wire `AttendanceModule` into `apps/api/src/app.module.ts`
- [X] T031 [US2] Write unit tests `attendance.service.spec.ts` covering: >150m rejected with distance, ≤150m on-time, ≤150m late, second check-in rejected (409), check-out without GPS, check-out without check-in rejected (400)

---

## Phase 6: User Story 3 — Attendance Adjustment & BullMQ Excel Report Job Pipeline

**Goal**: Complete `PATCH /attendance/:id` override and asynchronous `exceljs` report generation via BullMQ worker.

- [X] T032 [US3] Create `override-attendance.dto.ts` in `apps/api/src/attendance/dto/` requiring `overrideReason`, optional `checkInAt`, `checkOutAt`, `status`
- [X] T033 [US3] Implement `AttendanceService.override(id, adminId, dto)`:
  - Verify record exists
  - Require non-empty `overrideReason`
  - Update record setting `overridden_by = adminId` and `overridden_at = now()`
- [X] T034 [US3] Add `PATCH /attendance/:id` endpoint to `AttendanceController` (`ADMIN`)
- [X] T035 [US3] Implement `AttendanceReportWorker` BullMQ processor in `apps/api/src/attendance/attendance.worker.ts`:
  - Receives report job parameters (`from`, `to`, `department`, `employee_id`)
  - Queries `attendance_records` joined with `users`
  - Generates `.xlsx` using `exceljs` with proper column headers, date formatting, and styling
  - Uploads workbook buffer to Cloudinary via `StorageService.uploadFile`
  - Returns `{ downloadUrl, totalRows, completedAt }`
- [X] T036 [US3] Implement `GET /attendance/report` endpoint in `AttendanceController` (`ADMIN`): validates date range `from` and `to` (rejects range > 366 days with 400 `DATE_RANGE_EXCEEDS_MAXIMUM`), enqueues BullMQ job into `reports` queue, returning `{ "data": { "jobId": job.id } }` with status 202
- [X] T037 [US3] Write unit tests for attendance override validation and report worker formatting

---

## Phase 7: Verification & Quality Gates

**Purpose**: Verify all acceptance criteria and "Reject if" conditions from `PLAN.md` §9 and §4g.

- [X] T038 Write comprehensive E2E tests in `apps/api/test/m2a-hr-attendance.e2e-spec.ts`:
  - Create employee with warehouse assignment
  - Attempt technician check-in > 150m -> 400 with distance in details
  - Check-in <= 150m -> 201 `ON_TIME`
  - Second check-in on same day -> 409
  - Check-out without GPS requirement -> 200
  - Attendance override without reason -> 400; with reason -> 200
  - Image upload exceeding 5MB or invalid magic bytes -> 400
  - Status update to `INACTIVE` revokes refresh tokens; `ON_LEAVE` keeps tokens
  - Report endpoint enqueues job and returns `jobId`; `GET /jobs/:id` reports `COMPLETED` with valid download URL
- [X] T039 Execute types build — `pnpm --filter @alfahd/types build`
- [X] T040 Execute API typecheck — `pnpm --filter @alfahd/api typecheck`
- [X] T041 Execute API linter — `pnpm --filter @alfahd/api lint`
- [X] T042 Run full unit test suite — `pnpm --filter @alfahd/api test`
- [X] T043 Run full E2E test suite — `pnpm --filter @alfahd/api test:e2e`
- [X] T044 Execute production API build — `pnpm --filter @alfahd/api build`
- [X] T045 Verify zero TypeScript `enum` keywords across `@alfahd/types` and `apps/api` via ESLint `no-restricted-syntax` / grep verification (must exit 0 with 0 occurrences)

---

## Phase 8: Convergence

**Purpose**: Address gaps identified during convergence analysis between specification/contracts and current implementation.

- [X] T046 Generate secure temporary password and deliver via `EmailService.send` on employee creation per US1/AC2 (partial)
- [X] T047 Enforce job requester authorization in `JobsController` and `JobsService`, returning 404 for non-admin users querying other users' jobs per US3/AC5 (missing)
- [X] T048 Return structured `TECHNICIAN_REQUIRES_WAREHOUSE` 400 Bad Request error code when technician is created or updated without warehouse per US1/AC1 (partial)
- [X] T049 Support top-level `{ data, meta }` pagination envelope without double-nesting in `ResponseInterceptor` per plan: api-contracts.md §1.2 (partial)
- [X] T050 Explicitly return HTTP 200 on photo upload endpoint `POST /employees/:id/photo` per plan: api-contracts.md §1.6 (partial)

---

## Phase 9: Convergence

**Purpose**: Resolve critical E2E testing and background queue lifecycle defects identified during convergence analysis.

- [X] T051 Configure BullMQ and AttendanceReportWorker in test environment to avoid persistent Redis connection attempts and hook timeouts during test runs so that `test:e2e` passes without requiring local Docker Redis per Constitution III and AGENTS.md (contradicts)

