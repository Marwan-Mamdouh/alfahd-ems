# Feature Specification: Milestone M2a — HR & Attendance

**Feature Directory**: `specs/005-m2a-hr-attendance`  
**Feature Branch**: `feat/m2a-hr-attendance`  
**Created**: 2026-10-11  
**Status**: Approved (Locked by PLAN.md)  
**Source of Truth**: `PLAN.md` §6, §7d, §9 (M2a), §10

## Clarifications

### Session 2026-10-11
- Q: When an Admin uploads a new profile photo for an employee who already has an existing photo, how should the old photo in Cloudinary be handled? → A: Delete the old photo in Cloudinary immediately after the new `profile_photo_key` is successfully saved to the database.
- Q: What is the maximum date range permitted for an attendance report requested via GET /attendance/report? → A: Maximum 12 months (366 days) per report query; requests exceeding 366 days are rejected with 400 Bad Request (`DATE_RANGE_EXCEEDS_MAXIMUM`).
- Q: Is technician check-in permitted at any time during the calendar work date, or should there be an earliest allowed check-in time? → A: Permitted at any time during the local calendar `work_date` (`Africa/Cairo`), supporting flexible shift starts without arbitrary early-morning restrictions.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee Profile & Account Lifecycle Management (Priority: P1)

As an Admin, I manage employee records (department, warehouse assignment, contact information, national ID, hire date, profile photo, and operational status) so that all personnel are registered, correctly categorized, and assigned to home operating bases.

**Why this priority**:
Technicians cannot check in or receive ticket assignments without an employee record, home warehouse association, and active status. It establishes the personnel identity foundation for all operations.

**Independent Test**:
Can be fully tested by creating an employee via `POST /employees` with full profile fields, uploading a profile photo via `POST /employees/:id/photo`, updating status to `ON_LEAVE` or `INACTIVE` via `PATCH /employees/:id/status`, and querying with composable filters via `GET /employees?role=TECHNICIAN&warehouse_id=...`.

**Acceptance Scenarios**:
1. **Given** an authenticated Admin, **When** creating a user with role `TECHNICIAN` without `assigned_warehouse_id`, **Then** the request is rejected with 400 Bad Request (`TECHNICIAN_REQUIRES_WAREHOUSE`).
2. **Given** an authenticated Admin, **When** creating an employee with valid details and assigned warehouse, **Then** the record is created, a secure temporary password is generated and emailed, and the profile is queryable via `GET /employees/:id`.
3. **Given** an authenticated Admin, **When** uploading a photo exceeding 5 MB or with invalid magic bytes (e.g. renamed executable), **Then** the upload is rejected with 400 Bad Request, and Cloudinary storage remains untouched.
4. **Given** an authenticated Admin, **When** setting an employee status to `INACTIVE` with a mandatory reason, **Then** all active refresh token sessions for the user are revoked in Redis (`rt:{userId}:*`), preventing new token refreshes.
5. **Given** an authenticated Admin, **When** setting an employee status to `ON_LEAVE` with a mandatory reason, **Then** the status updates, existing sessions remain valid, but the technician is flagged ineligible for ticket assignment.

---

### User Story 2 - GPS-Geofenced Attendance Check-In & Check-Out (Priority: P1)

As a field technician, I check in at my assigned home warehouse using my mobile device's GPS coordinates upon arrival and check out at the end of my shift from anywhere without returning to base, so that my work attendance and punctuality are accurately recorded.

**Why this priority**:
Field operational integrity and tracking depend on knowing when technicians begin and conclude their shifts. Lateness flags drive technician performance metrics.

**Independent Test**:
Can be fully tested by a technician calling `POST /attendance/check-in` with coordinates within and outside the 150m warehouse radius, verifying 400 when >150m, verifying `ON_TIME` vs `LATE` based on `ATTENDANCE_CUTOFF_TIME` (09:00), and calling `POST /attendance/check-out` from any location.

**Acceptance Scenarios**:
1. **Given** a technician whose coordinates are >150m from their home warehouse, **When** attempting check-in, **Then** the server rejects the request with 400 Bad Request, including the server-calculated distance in meters in the error details.
2. **Given** a technician whose coordinates are ≤150m from their home warehouse before 09:00 (Cairo time), **When** checking in, **Then** an attendance record is created with status `ON_TIME`, capturing local `work_date`, exact server timestamp, coordinates, and calculated distance.
3. **Given** a technician checking in after 09:00 (Cairo time), **When** checking in within the radius, **Then** the record is created with status `LATE`.
4. **Given** a technician who has already checked in today, **When** attempting a second check-in on the same `work_date`, **Then** the request is rejected with 409 Conflict (`ALREADY_CHECKED_IN`), even if already checked out.
5. **Given** a technician with an open check-in today, **When** checking out via `POST /attendance/check-out`, **Then** `check_out_at` is set to the current timestamp without any GPS coordinate requirement.
6. **Given** a technician without an active check-in today, **When** attempting check-out, **Then** the request is rejected with 400 Bad Request (`NO_ACTIVE_CHECK_IN`).

---

### User Story 3 - Attendance Management Override & Excel Report Job Pipeline (Priority: P2)

As an Admin, I correct attendance records with a recorded audit justification and export attendance records over arbitrary date ranges (up to 12 months) into Excel via an asynchronous background job, so that payroll review and compliance audits can proceed without blocking the API.

**Why this priority**:
Admins require supervisory adjustment capabilities for real-world exceptions (e.g. hardware failure, authorized off-site start). Long-running Excel report generation must not cause HTTP request timeouts.

**Independent Test**:
Can be fully tested by an Admin calling `PATCH /attendance/:id` to adjust check-in/out times with a mandatory reason, requesting `GET /attendance/report?from=...&to=...`, receiving a `jobId`, polling `GET /jobs/:id` until complete, and downloading the generated Excel sheet.

**Acceptance Scenarios**:
1. **Given** an existing attendance record, **When** an Admin calls `PATCH /attendance/:id` without providing an `override_reason`, **Then** the request is rejected with 400 Bad Request.
2. **Given** an existing attendance record, **When** an Admin provides valid adjustments and an `override_reason`, **Then** the record is updated, setting `overridden_by` to the Admin ID and `overridden_at` to the current timestamp.
3. **Given** an authenticated Admin requesting an attendance report, **When** submitting date range filters, **Then** the API enqueues a BullMQ job and immediately returns `{ "jobId": "<uuid>" }` with status 202 Accepted.
4. **Given** an enqueued report job, **When** the BullMQ worker completes processing, **Then** an `.xlsx` workbook is created with formatted columns, uploaded to Cloudinary, and `GET /jobs/:id` returns status `COMPLETED` with a secure download URL.
5. **Given** an inquiry on a non-existent job or a job belonging to another requester (when not Admin), **Then** the request returns 404 Not Found.

---

### Edge Cases

- **Timezone Transitions & Midnight Crossings**: `work_date` is evaluated strictly in `Africa/Cairo` (accounting for Egypt Daylight Saving Time), never UTC or fixed offset. A check-in at 23:59 UTC (01:59 Cairo) registers on the Cairo calendar day.
- **Clock Manipulation**: Client device timestamps are completely ignored; server clock (`ClockService`) determines `check_in_at` and `work_date`.
- **Database Rollback on Failed Cloudinary Upload**: If database transaction fails after photo upload, the uploaded object in Cloudinary is immediately deleted via compensation call.
- **Multiple Concurrent Check-in Attempts**: Database unique constraint on `(user_id, work_date)` ensures atomic deduplication, preventing race conditions.
- **Technician with No Assigned Warehouse**: Returns 409 Conflict (`NO_ASSIGNED_WAREHOUSE`) on check-in.
- **Absent Days**: Absent days are represented by the absence of records; no synthetic "ABSENT" rows are created in the database.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend `users` schema with `phone`, `national_id`, `hire_date`, `profile_photo_key`, `assigned_warehouse_id`. All domain value sets (`Department`, `UserStatus`, `AttendanceStatus`) MUST strictly be defined as `as const` arrays/objects with derived TypeScript union types — **the TypeScript `enum` keyword is strictly prohibited across the entire codebase**. Database Drizzle `pgEnum` types must derive directly from the `as const` arrays.
- **FR-002**: System MUST migrate existing M1 user records safely, mapping or nulling non-conforming department values and logging mappings during migration.
- **FR-003**: System MUST provide employee endpoints `POST /employees`, `GET /employees`, `GET /employees/:id`, `PATCH /employees/:id`, `PATCH /employees/:id/status`, `POST /employees/:id/photo` under `ADMIN` role (with self-view for `GET /employees/:id`).
- **FR-004**: System MUST validate that creating or editing an employee with role `TECHNICIAN` enforces a valid, existing `assigned_warehouse_id`.
- **FR-005**: System MUST validate photo uploads for maximum 5 MB size and verify magic bytes (JPEG/PNG) rather than relying solely on the client-declared `Content-Type`.
- **FR-006**: System MUST store Cloudinary `public_id` in `profile_photo_key`, support responsive URL transformations on retrieval, and delete the previous asset from Cloudinary immediately upon successful database update when a photo is replaced.
- **FR-007**: System MUST revoke all active sessions in Redis (`rt:{userId}:*`) when employee status is set to `INACTIVE`.
- **FR-008**: System MUST compute distance server-side using the Haversine formula against the technician's home warehouse GPS coordinates.
- **FR-009**: System MUST reject check-in if calculated distance exceeds `ATTENDANCE_RADIUS_M` (150m default) with 400 Bad Request, returning the measured distance.
- **FR-010**: System MUST enforce exactly one check-in per technician per calendar day in `APP_TIMEZONE` (`Africa/Cairo`) via database unique constraint `(user_id, work_date)`, permitting check-in at any hour of that calendar day without an earliest-hour restriction.
- **FR-011**: System MUST flag attendance as `LATE` if `check_in_at` local time is past `ATTENDANCE_CUTOFF_TIME` (default 09:00), otherwise `ON_TIME`.
- **FR-012**: System MUST permit check-out without GPS validation, provided an open check-in exists for today.
- **FR-013**: System MUST allow Admins to override attendance records via `PATCH /attendance/:id`, requiring a non-empty `override_reason` and auditing `overridden_by` and `overridden_at`.
- **FR-014**: System MUST validate attendance report date range filters (`from`, `to`), enforcing a maximum range of 12 months (366 days) with 400 Bad Request if exceeded, and enqueue Excel report generation into a BullMQ queue (`reports`) via `GET /attendance/report`, returning `{ jobId }` with status 202 without synchronous blocking.
- **FR-015**: System MUST provide `GET /jobs/:id` returning `{ id, status, downloadUrl?, error? }` backed by BullMQ in M2a.

---

### Key Entities

- **User / Employee**: Extends M1 `users`. Core identity possessing role, department, warehouse assignment, and profile credentials.
- **Attendance Record**: Represents a technician's daily work shift (`attendance_records`). Unique per `(user_id, work_date)`. Tracks check-in timestamp, coordinates, distance, status (`ON_TIME | LATE`), check-out timestamp, and override audit trail.
- **Report Job**: Background BullMQ job tracking asynchronous generation of formatted Excel documents and their Cloudinary storage location.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Check-in distance verification executes in < 50ms server processing time.
- **SC-002**: 100% of check-in attempts outside the 150m boundary are rejected with distance details.
- **SC-003**: 100% of second check-in attempts on the same calendar day fail with 409 Conflict.
- **SC-004**: 12-month attendance report for 100+ technicians completes generation in < 60 seconds via background worker.
- **SC-005**: All photo uploads with mismatched magic bytes are rejected without uploading to Cloudinary.
- **SC-006**: Existing M1 database rows are completely preserved during migration with zero data corruption.

---

## Assumptions

- **Timezone**: Egypt observes DST during summer months; IANA timezone `Africa/Cairo` handles DST transitions automatically via Luxon / date-fns-tz / standard Intl APIs.
- **Storage**: Real Cloudinary credentials will be supplied in staging/production; testing relies on `FakeStorageService` simulating uploads and deletes in memory.
- **Email**: Password delivery uses existing `EmailProvider` established in M1.
- **Excel Library**: `exceljs` is used for creating `.xlsx` files with styled headers, dates, and Arabic text support.
