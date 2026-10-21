# Implementer Prompt: Fix Security Vulnerabilities & Simplify Code (Milestone M2a)

> **Context for Implementer Model**:
> You are tasked with resolving security vulnerabilities, fixing error handling/edge cases, and simplifying overly complex code in the AlFahd EMS repository for **Milestone M2a (HR & Attendance)** on branch `feat/m2a-hr-attendance`.
>
> **Repository Rules to Respect**:
> 1. **ESM Imports**: All relative imports in `apps/api/src` MUST include the explicit `.js` extension (e.g. `import { foo } from './foo.js'`).
> 2. **Types Build Order**: If `@alfahd/types` is edited, compile it first with `pnpm --filter @alfahd/types build` before compiling or testing `apps/api`.
> 3. **TypeScript Enums**: The TypeScript `enum` keyword is strictly prohibited across the monorepo. Use `as const` object/array maps with derived union types.
> 4. **No Direct ESLint/Vitest at Root**: Run checks via `pnpm --filter @alfahd/api test`, `pnpm --filter @alfahd/api test:e2e`, `pnpm --filter @alfahd/api typecheck`, and `pnpm --filter @alfahd/api lint`.
> 5. **Preserve Existing Tests**: Keep all existing tests green and add unit/e2e test coverage for your fixes.

---

## Part 1: Security Issues & Edge-Case Vulnerabilities

### SEC-01: Spreadsheet Formula Injection (CSV / Formula Injection, CWE-1236)
- **File**: [`apps/api/src/attendance/attendance.worker.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.worker.ts#L82-L103)
- **Problem**:
  In `AttendanceReportWorker`, user-supplied strings—specifically `item.user.name` and `item.record.overrideReason`—are written directly to Excel cells using ExcelJS (`worksheet.addRow(...)`). If an admin or employee inputs values beginning with `=`, `+`, `-`, `@`, `\t`, or `\r`, spreadsheet engines (Microsoft Excel, LibreOffice, Google Sheets) interpret them as executable formulas or external commands when an HR manager opens the generated `.xlsx` report.
- **Action Required**:
  1. Create or use a cell sanitizer function (e.g. `sanitizeSpreadsheetCell(value: string | null | undefined): string`).
  2. If the string starts with any formula trigger character (`=`, `+`, `-`, `@`, `\t`, `\r`), prepend a single apostrophe `'` or wrap/strip the unsafe character so Excel treats it strictly as literal text.
  3. Apply this sanitizer to `name`, `overrideReason`, and any other dynamic user text when adding rows in `attendance.worker.ts`.

---

### SEC-02: HTML Injection / Stored XSS in Welcome Email
- **File**: [`apps/api/src/users/users.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/users/users.service.ts#L121-L127)
- **Problem**:
  In `UsersService.createEmployee`, `dto.name` is directly interpolated into the HTML template:
  ```typescript
  html: `<p>Welcome to AlFahd EMS, <strong>${dto.name}</strong>!</p><p>Your account has been created with temporary password: <code>${tempPassword}</code></p>...`
  ```
  If an admin registers an employee with a payload containing HTML tags or scripts (e.g., `<img src=x onerror=...>` or `<a href="...">`), it is rendered unescaped in the recipient's email client, exposing the recipient to HTML injection or email client exploits.
- **Action Required**:
  1. Add a small escaping utility (e.g., in `apps/api/src/common/utils/html.utils.ts` or inline helper) that escapes `&`, `<`, `>`, `"`, and `'` into HTML entities.
  2. Escape `dto.name` before interpolating it into the `html` field sent to `EmailService`.

---

### SEC-03: Denial of Service (DoS) via Unbounded Multer Memory Buffering
- **File**: [`apps/api/src/employees/employees.controller.ts`](file:///g:/repos/alfahd-ems/apps/api/src/employees/employees.controller.ts#L69-L78)
- **Problem**:
  In `uploadPhoto`:
  ```typescript
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(...)
  ```
  While `EmployeesService.uploadPhoto` checks `file.buffer.length > 5 * 1024 * 1024`, Multer's default memory storage buffers the **entire** incoming HTTP payload into Node.js heap memory before the controller or service method is even invoked. An attacker streaming a 500 MB+ multipart file can exhaust Node.js memory and crash the process.
- **Action Required**:
  1. Pass the size limit directly to `FileInterceptor` options:
     ```typescript
     @UseInterceptors(FileInterceptor('file', {
       limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
     }))
     ```
  2. Handle Multer's `LIMIT_FILE_SIZE` error in `HttpExceptionFilter` (or let it map cleanly to 400 Bad Request with a clear error code `FILE_TOO_LARGE`).

---

### SEC-04: Information Disclosure via BullMQ `failedReason`
- **File**: [`apps/api/src/jobs/jobs.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/jobs/jobs.service.ts#L45-L47)
- **Problem**:
  `JobsService.getJobStatus` returns:
  ```typescript
  return {
    id: String(job.id),
    status,
    downloadUrl: job.returnvalue?.downloadUrl ?? null,
    error: job.failedReason ?? null,
  };
  ```
  If a worker fails due to a database connection timeout, query error, or Cloudinary failure, `job.failedReason` can leak internal database connection strings, table details, stack traces, or operational internals to the client.
- **Action Required**:
  1. Mask or sanitize `failedReason` for client responses.
  2. For non-production or non-admin callers, return a sanitized generic error message (e.g., `'Report generation failed'`) while logging the full `job.failedReason` on the server using `Logger`.

---

### SEC-05: Predictable BullMQ Job IDs & Enumeration
- **File**: [`apps/api/src/attendance/attendance.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.service.ts#L270-L276)
- **Problem**:
  `this.reportsQueue.add('attendance-summary', { ... })` does not supply a custom `jobId`. BullMQ generates sequential integer strings (`'1'`, `'2'`, `'3'`). This contradicts the specification (`specs/005-m2a-hr-attendance/spec.md` line 72: `{ "jobId": "<uuid>" }`) and allows trivial enumeration of job IDs.
- **Action Required**:
  1. Generate a UUID for each enqueued job using `randomUUID()` from `node:crypto`.
  2. Pass `{ jobId: randomUUID() }` as the third argument to `this.reportsQueue.add(...)`.

---

### SEC-06: Missing UUID Parameter Validation Causing 500 DB Crashes
- **Files**:
  - [`apps/api/src/employees/employees.controller.ts`](file:///g:/repos/alfahd-ems/apps/api/src/employees/employees.controller.ts#L49-L78)
  - [`apps/api/src/attendance/attendance.controller.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.controller.ts#L46-L54)
- **Problem**:
  Endpoints such as `GET /employees/:id`, `PATCH /employees/:id`, `PATCH /employees/:id/status`, `POST /employees/:id/photo`, and `PATCH /attendance/:id` declare `@Param('id') id: string` without `ParseUUIDPipe`. If a client calls `/employees/invalid-uuid`, the raw string is passed to PostgreSQL, triggering error code `22P02` (`invalid input syntax for type uuid`). Because this is an unhandled database exception, `HttpExceptionFilter` catches it and logs a 500 Internal Server Error instead of rejecting with 400 Bad Request.
- **Action Required**:
  1. Add `new ParseUUIDPipe()` or `@Param('id', ParseUUIDPipe)` to all route handlers that expect a UUID `:id`.

---

### SEC-07: Insufficient DTO Validation Causing String Truncation / Date Syntax 500s
- **Files**:
  - [`apps/api/src/employees/dto/create-employee.dto.ts`](file:///g:/repos/alfahd-ems/apps/api/src/employees/dto/create-employee.dto.ts)
  - [`apps/api/src/attendance/dto/override-attendance.dto.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/dto/override-attendance.dto.ts)
- **Problem**:
  1. In `CreateEmployeeRequestDto`, `hireDate?: string` is annotated with `@IsString()` instead of `@IsDateString()`. A value like `"not-a-date"` will pass validation but cause PostgreSQL to throw an error on inserting into `date('hire_date')`.
  2. `phone` and `nationalId` have `@IsString()`, but no `@MaxLength(30)`. In PostgreSQL, both columns are `varchar(30)`. Passing 31+ characters triggers `value too long for type character varying(30)` (status 500).
  3. In `OverrideAttendanceRequestDto`, there is no validation verifying that `checkOutAt` is chronologically after `checkInAt` when both are provided.
- **Action Required**:
  1. Add `@IsDateString()` to `hireDate`.
  2. Add `@MaxLength(30)` to `phone` and `nationalId`.
  3. In `OverrideAttendanceRequestDto` or `AttendanceService.override`, validate that if both `checkInAt` and `checkOutAt` are set, `new Date(checkOutAt).getTime() >= new Date(checkInAt).getTime()`.

---

### SEC-08: Concurrency Race Condition on Check-In Returning 500 Instead of 409
- **File**: [`apps/api/src/attendance/attendance.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.service.ts#L90-L122)
- **Problem**:
  `checkIn` first queries `this.db.select().from(attendanceRecords).where(...)` to verify no check-in exists for today. If two check-in requests for the same technician arrive concurrently, both pass the `existing.length > 0` check. The second `insert` hits the database unique constraint `attendance_records_user_id_work_date_unique` (Postgres error code `23505`). Because `this.db.insert(...)` is not in a try-catch, this bubbles up as an unhandled error and returns `500 Internal Server Error` instead of `409 Conflict` (`ALREADY_CHECKED_IN`).
- **Action Required**:
  1. Wrap the `this.db.insert(attendanceRecords)` in a `try...catch`.
  2. If the caught error is a PostgreSQL unique constraint violation (e.g. `error.code === '23505'` or matching `attendance_records_user_id_work_date_unique`), throw an `HttpException` with `{ code: 'ALREADY_CHECKED_IN', message: 'Attendance record already exists for today' }` and `HttpStatus.CONFLICT`.

---

### SEC-09: Numerical Instability in Haversine Formula
- **File**: [`apps/api/src/common/utils/geo.utils.ts`](file:///g:/repos/alfahd-ems/apps/api/src/common/utils/geo.utils.ts#L16-L20)
- **Problem**:
  In `haversineDistanceMeters`:
  ```typescript
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  ```
  Floating-point rounding can cause `a` to exceed `1` (e.g., `1.0000000000000002`). When `a > 1`, `1 - a` becomes negative, `Math.sqrt(1 - a)` returns `NaN`, and the entire distance calculation evaluates to `NaN`. Because `NaN > allowedRadius` evaluates to `false` in JavaScript, an out-of-range check-in could erroneously succeed.
- **Action Required**:
  1. Clamp `a` between `0` and `1` before calculating `c`:
     ```typescript
     const clampedA = Math.min(1, Math.max(0, a));
     const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
     ```

---

### SEC-10: Silent Production Fallback to In-Memory Fake Storage
- **Files**:
  - [`apps/api/src/config/env.validation.ts`](file:///g:/repos/alfahd-ems/apps/api/src/config/env.validation.ts#L36-L38)
  - [`apps/api/src/storage/storage.module.ts`](file:///g:/repos/alfahd-ems/apps/api/src/storage/storage.module.ts#L16-L20)
- **Problem**:
  `StorageModule` checks:
  ```typescript
  if (nodeEnv === 'test' || !cloudName) {
    return new FakeStorageService();
  }
  ```
  If `CLOUDINARY_CLOUD_NAME` is omitted in production, the application starts normally and silently falls back to `FakeStorageService`. All employee photos and generated reports are stored in ephemeral container memory and lost upon container restart.
- **Action Required**:
  1. In `env.validation.ts`, refine the schema so that when `NODE_ENV === 'production'`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are required.
  2. In `StorageModule`, fail loudly if running in production without Cloudinary credentials.

---

## Part 2: Code Complexity Reduction & Clean Architecture

### SIMP-01: Eliminate In-Memory Department Filtering in Excel Worker
- **File**: [`apps/api/src/attendance/attendance.worker.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.worker.ts#L36-L51)
- **Problem**:
  The worker joins `users` on `attendance_records.userId = users.id`, but filters `department` in Node.js memory:
  ```typescript
  const rows = await this.db.select(...).from(attendanceRecords).innerJoin(users, ...).where(conditions);
  const filteredRows = department ? rows.filter((r) => r.user.department === department) : rows;
  ```
  This loads all company attendance records into Node memory across the network before discarding irrelevant rows.
- **Action Required**:
  1. Move the department filter directly into the SQL query conditions:
     ```typescript
     if (department) conditions.push(eq(users.department, department));
     ```
  2. Remove the `.filter(...)` call and use `rows` directly.

---

### SIMP-02: Eliminate O(N) Redis `SCAN` on Every Token Refresh
- **File**: [`apps/api/src/redis/session.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/redis/session.service.ts#L27-L38)
- **Problem**:
  In `findSessionByTokenId(tokenId: string)`, Redis executes `scan(cursor, 'MATCH', 'rt:*:${tokenId}', 'COUNT', 100)` in a loop across the entire Redis keyspace. Token refresh is a high-frequency operation; iterating the entire keyspace on every refresh introduces severe latency and CPU spikes under load.
- **Action Required**:
  1. Refactor the key structure to allow O(1) lookups:
     - Store the session as `rt:token:${tokenId}` with value `{ userId }` (or plain `userId`).
     - To revoke all sessions for a user, maintain a Redis Set `rt:user_tokens:${userId}` containing the active `tokenId`s.
  2. `findSessionByTokenId` becomes a direct `redis.get(`rt:token:${tokenId}`)` (O(1)).
  3. `revokeSession` deletes the token key and removes it from the user set.
  4. `revokeAllSessions` reads members from the user set (O(K) where K is the user's active sessions), deletes their session keys in a pipeline, and deletes the set.

---

### SIMP-03: Simplify Cutoff Calculation in `ClockService`
- **File**: [`apps/api/src/common/services/clock.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/common/services/clock.service.ts#L26-L49)
- **Problem**:
  `isAfterCutoff` constructs a new `Intl.DateTimeFormat`, formats to parts, runs `.find()` 3 times for hour, minute, and second, parses numbers, splits the cutoff string, and executes chained comparisons.
- **Action Required**:
  1. Simplify to format the local time directly into a comparable `"HH:mm:ss"` string (or `"HH:mm"`) using `Intl.DateTimeFormat` with `timeZone`, and do a direct lexicographical comparison (e.g., `currentTimeStr > `${cutoffTime}:00``).
  2. Cache or reuse the formatter instance if possible, or keep the helper under 5 clean lines.

---

### SIMP-04: Reconcile Dual State (`isActive` vs `status`) to Prevent Inadvertent Deactivation
- **Files**:
  - [`apps/api/src/database/schema/index.ts`](file:///g:/repos/alfahd-ems/apps/api/src/database/schema/index.ts#L44-L46)
  - [`apps/api/src/users/users.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/users/users.service.ts#L223-L236)
  - [`apps/api/src/auth/auth.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/auth/auth.service.ts#L56-L92)
- **Problem**:
  `UsersService.updateEmployeeStatus` sets `isActive = status === 'ACTIVE'`.
  If an admin sets an employee status to `ON_LEAVE`, `isActive` becomes `false`. Consequently, `AuthService.findActiveUserByEmail` returns `null` and `AuthService.refresh` rejects with `UnauthorizedException`. This contradicts the specification (`specs/005-m2a-hr-attendance/spec.md` Acceptance Scenario 5: *"When setting an employee status to ON_LEAVE... existing sessions remain valid"*).
- **Action Required**:
  1. Set `isActive = status !== 'INACTIVE'` (an employee `ON_LEAVE` is still an active employee with a valid account, but inactive only when `status === 'INACTIVE'`).
  2. When status is `ON_LEAVE`, do NOT revoke active sessions or prevent login, but ensure ticketing assignment checks inspect `user.status === 'ACTIVE'`.

---

### SIMP-05: Deduplicate Clamping & Default Handling in Pagination
- **Files**:
  - [`apps/api/src/employees/dto/employee-query.dto.ts`](file:///g:/repos/alfahd-ems/apps/api/src/employees/dto/employee-query.dto.ts#L34-L45)
  - [`apps/api/src/employees/employees.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/employees/employees.service.ts#L31-L32)
  - [`apps/api/src/users/users.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/users/users.service.ts#L137-L138)
- **Problem**:
  The logic `const page = Math.max(1, query.page ?? 1)` and `const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))` is duplicated in 3 different files. Because `ValidationPipe` with `{ transform: true }` is enabled globally, `EmployeeQueryRequestDto` can be the single source of truth.
- **Action Required**:
  1. Rely on the DTO defaults and constraints in `EmployeeQueryRequestDto`, removing redundant clamping across `EmployeesService` and `UsersService`.

---

### SIMP-06: Unify `hoursWorked` Calculation Across Service & Worker
- **Files**:
  - [`apps/api/src/attendance/attendance.service.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.service.ts#L175-L177)
  - [`apps/api/src/attendance/attendance.worker.ts`](file:///g:/repos/alfahd-ems/apps/api/src/attendance/attendance.worker.ts#L86-L89)
- **Problem**:
  `checkOut` computes `Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100`, `attendance.worker.ts` computes `(ms / (1000 * 60 * 60)).toFixed(2)`, and `override` omits `hoursWorked` entirely.
- **Action Required**:
  1. Extract a shared helper `calculateHoursWorked(checkIn: Date | string, checkOut?: Date | string | null): number | null`.
  2. Use this helper consistently in `AttendanceService.checkOut`, `AttendanceService.override`, and `AttendanceReportWorker`.

---

### SIMP-07: Add Missing Database Index on `attendance_records.work_date`
- **File**: [`apps/api/src/database/schema/index.ts`](file:///g:/repos/alfahd-ems/apps/api/src/database/schema/index.ts#L71-L76)
- **Problem**:
  `attendance_records` currently only has a composite unique constraint on `(user_id, work_date)`. When `AttendanceReportWorker` generates a date-range report across all technicians (`work_date >= from AND work_date <= to`), Postgres cannot use `(user_id, work_date)` because `user_id` is omitted. This forces a sequential table scan on every report generation.
- **Action Required**:
  1. Add an index on `workDate` (e.g. `index('attendance_records_work_date_idx').on(t.workDate)`) in `apps/api/src/database/schema/index.ts`.
  2. Run `pnpm --filter @alfahd/api drizzle-kit generate` to create the migration SQL.

---

## Part 3: Verification & Test Protocol

After implementing the fixes:
1. Build types:
   ```bash
   pnpm --filter @alfahd/types build
   ```
2. Run TypeScript check:
   ```bash
   pnpm --filter @alfahd/api typecheck
   ```
3. Run linting:
   ```bash
   pnpm --filter @alfahd/api lint
   ```
4. Run unit and e2e tests:
   ```bash
   pnpm --filter @alfahd/api test
   pnpm --filter @alfahd/api test:e2e
   ```
5. Confirm that all 18 unit test suites and all 4 e2e test suites pass with 0 errors.
