# Implementer Plan: Code Hardening & Spec Alignment (Milestone M2a)

> **Context for Implementer Agent**:  
> Following the second code review of uncommitted changes on branch `feat/m2a-hr-attendance`, this document outlines the exact execution plan to address 9 identified code smells, edge cases, and security hardening opportunities across Standards and Spec axes.
>
> **Repository Rules to Respect**:
> 1. **ESM Imports**: All relative imports in `apps/api/src` MUST include the explicit `.js` extension (e.g. `import { foo } from './foo.js'`).
> 2. **Types Build Order**: If `@alfahd/types` is touched, compile it first: `pnpm --filter @alfahd/types build`.
> 3. **TypeScript Enums**: The `enum` keyword is strictly prohibited. Use `as const` objects/arrays with derived union types.
> 4. **No Direct ESLint/Vitest at Root**: Run all checks scoped to packages: `pnpm --filter @alfahd/api test`, `pnpm --filter @alfahd/api test:e2e`, `pnpm --filter @alfahd/api typecheck`, and `pnpm --filter @alfahd/api lint`.
> 5. **Preserve Existing Tests**: Keep all 22 unit test suites and 4 e2e test suites passing green while adding test coverage for each hardening fix.

---

## Task Summary Table

| ID | Category | Target File(s) | Description |
|---|---|---|---|
| **HARD-01** | Standards (Perf) | `apps/api/src/common/services/clock.service.ts` | Cache `Intl.DateTimeFormat` for `getLocalWorkDate` by timezone |
| **HARD-02** | Standards (Redis) | `apps/api/src/redis/session.service.ts` | Prevent unbounded session Set growth using Redis Sorted Sets (ZSET) or active pruning |
| **HARD-03** | Standards (Security) | `apps/api/src/redis/session.service.ts`<br>`apps/api/src/auth/auth.service.ts` | Store `userId` in `rv:${tokenId}` for security attribution on revoked token replay |
| **HARD-04** | Standards (Validation) | `apps/api/src/employees/dto/create-employee.dto.ts`<br>`apps/api/src/employees/dto/update-employee.dto.ts` | Add `@MaxLength(255)` to `name` to prevent unhandled PostgreSQL 500 errors |
| **HARD-05** | Standards (Clean Arch) | `apps/api/src/users/users.controller.ts`<br>`apps/api/src/users/users.service.ts` | Encapsulate session revocation inside `UsersService.deactivate` (eliminate controller feature envy) |
| **HARD-06** | Spec (Edge Case) | `apps/api/src/attendance/attendance.service.ts` | Align distance threshold evaluation with `roundedDistance` (eliminate 150.0m false rejection) |
| **HARD-07** | Spec (Contract) | `apps/api/src/jobs/jobs.service.ts` | Always populate `error = GENERIC_JOB_ERROR` when `status === 'FAILED'` |
| **HARD-08** | Spec (Security) | `apps/api/src/auth/auth.service.ts`<br>`apps/api/src/users/users.service.ts` | Revoke all active sessions on password reset (`resetPassword`) and change (`changePassword`) |
| **HARD-09** | Spec (UX/I18N) | `apps/api/src/attendance/attendance.worker.ts` | Format Excel check-in/out timestamps in local Cairo timezone instead of raw UTC ISO strings |

---

## Detailed Implementation Guidance

### HARD-01: Cache Date Formatters in `ClockService`

- **File**: `apps/api/src/common/services/clock.service.ts`
- **Problem**:
  `localTimeString` caches its `Intl.DateTimeFormat` in `timeFormatters`, but `getLocalWorkDate` instantiates `new Intl.DateTimeFormat('en-CA', ...)` on every call. Every check-in and check-out runs `getLocalWorkDate(now, timezone)`.
- **Action**:
  1. Add a module-level `dateFormatters = new Map<string, Intl.DateTimeFormat>()`.
  2. In `getLocalWorkDate(date: Date, timeZone = 'Africa/Cairo'): string`:
     ```typescript
     let formatter = dateFormatters.get(timeZone);
     if (!formatter) {
       formatter = new Intl.DateTimeFormat('en-CA', {
         timeZone,
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
       });
       dateFormatters.set(timeZone, formatter);
     }
     return formatter.format(date);
     ```
  3. Ensure `apps/api/src/common/services/clock.service.spec.ts` continues to pass and add a check verifying date formatting consistency.

---

### HARD-02: Bounded Session Management in `SessionService`

- **Files**:
  - `apps/api/src/redis/session.service.ts`
  - `apps/api/src/redis/session.service.spec.ts`
  - `apps/api/test/auth.e2e-spec.ts`
  - `apps/api/test/users.e2e-spec.ts`
  - `apps/api/test/m2a-hr-attendance.e2e-spec.ts`
- **Problem**:
  `rt:user_tokens:{userId}` is currently a plain Redis Set with a sliding 7-day TTL. When individual session keys `rt:token:{tokenId}` expire, their IDs remain in the set. If a user logs in once every few days, the set's TTL is continually reset and expired IDs accumulate indefinitely.
- **Action**:
  1. Model `rt:user_tokens:{userId}` as a Redis Sorted Set (ZSET) where score = `expiresAtMs` (`Date.now() + REFRESH_SESSION_TTL_SECONDS * 1000`).
  2. In `createSession(userId: string, tokenId: string)`:
     ```typescript
     const userTokens = userTokensKey(userId);
     const nowMs = Date.now();
     const expiresAtMs = nowMs + REFRESH_SESSION_TTL_SECONDS * 1000;
     const pipeline = this.redis.pipeline();
     // Prune expired tokens for this user in O(log N + M)
     pipeline.zremrangebyscore(userTokens, 0, nowMs);
     pipeline.zadd(userTokens, expiresAtMs, tokenId);
     pipeline.expire(userTokens, REFRESH_SESSION_TTL_SECONDS);
     pipeline.set(sessionKey(tokenId), userId, 'EX', REFRESH_SESSION_TTL_SECONDS);
     await pipeline.exec();
     ```
  3. In `revokeSession(userId: string, tokenId: string)`:
     ```typescript
     const pipeline = this.redis.pipeline();
     pipeline.del(sessionKey(tokenId));
     pipeline.zrem(userTokensKey(userId), tokenId);
     pipeline.set(revokedKey(tokenId), userId, 'EX', REVOKED_TOKEN_TTL_SECONDS);
     await pipeline.exec();
     ```
  4. In `revokeAllSessions(userId: string)`:
     ```typescript
     const userTokens = userTokensKey(userId);
     // Read all active tokens (score > nowMs or all remaining)
     const tokenIds = await this.redis.zrange(userTokens, 0, -1);
     if (tokenIds.length === 0) return 0;

     const pipeline = this.redis.pipeline();
     for (const tokenId of tokenIds) {
       pipeline.del(sessionKey(tokenId));
       pipeline.set(revokedKey(tokenId), userId, 'EX', REVOKED_TOKEN_TTL_SECONDS);
     }
     pipeline.del(userTokens);
     await pipeline.exec();
     return tokenIds.length;
     ```
  5. Update the Redis double/stubs in `session.service.spec.ts`, `auth.e2e-spec.ts`, `users.e2e-spec.ts`, and `m2a-hr-attendance.e2e-spec.ts` to support `zadd`, `zrem`, `zrange`, and `zremrangebyscore`.

---

### HARD-03: Security Attribution for Revoked Token Replay

- **Files**:
  - `apps/api/src/redis/session.service.ts`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/auth.service.spec.ts`
- **Problem**:
  `revokedKey(tokenId)` stores `'1'`, preventing `AuthService.refresh` from logging which user account was targeted when a revoked token is replayed (`userId: null`).
- **Action**:
  1. In `SessionService`:
     - In `revokeSession` and `revokeAllSessions`: Save `userId` instead of `'1'` into `revokedKey(tokenId)`:
       ```typescript
       pipeline.set(revokedKey(tokenId), userId, 'EX', REVOKED_TOKEN_TTL_SECONDS);
       ```
     - Add helper:
       ```typescript
       async getRevokedTokenUserId(tokenId: string): Promise<string | null> {
         return this.redis.get(revokedKey(tokenId));
       }
       ```
  2. In `AuthService.refresh`:
     ```typescript
     if (!session) {
       const revokedUserId = await this.sessionService.getRevokedTokenUserId(refreshToken);
       if (revokedUserId) {
         this.logger.warn('Revoked refresh token reuse detected', {
           tokenId: refreshToken,
           userId: revokedUserId,
           ip: ip ?? 'unknown',
           timestamp: new Date().toISOString(),
           reason: 'revoked_token_reuse',
         });
       }
       throw new UnauthorizedException('Invalid refresh token');
     }
     ```
  3. Add test assertion verifying that `revokedUserId` is populated in the security log metadata.

---

### HARD-04: Prevent Database String Truncation 500s on `name`

- **Files**:
  - `apps/api/src/employees/dto/create-employee.dto.ts`
  - `apps/api/src/employees/dto/update-employee.dto.ts`
- **Problem**:
  In PostgreSQL, `users.name` is `varchar(255)`. Sending 256+ characters triggers an unhandled 500 error (`value too long for type character varying(255)`).
- **Action**:
  1. In `CreateEmployeeRequestDto`:
     ```typescript
     @IsString()
     @IsNotEmpty()
     @MaxLength(255)
     name: string;
     ```
  2. In `UpdateEmployeeRequestDto`:
     ```typescript
     @IsOptional()
     @IsString()
     @MaxLength(255)
     name?: string;
     ```
  3. Add unit/e2e test checking that a 256-character `name` is rejected with 400 Bad Request.

---

### HARD-05: Encapsulate User Deactivation Session Revocation in `UsersService`

- **Files**:
  - `apps/api/src/users/users.service.ts`
  - `apps/api/src/users/users.controller.ts`
  - `apps/api/src/users/users.service.spec.ts`
- **Problem**:
  `UsersController.update` contains feature envy: it checks `if (dto.isActive === false)` and calls `this.sessionService.revokeAllSessions(id)`.
- **Action**:
  1. Inject `SessionService` into `UsersService`:
     ```typescript
     constructor(
       @Inject(DRIZZLE) private readonly db: Db,
       private readonly emailService: EmailService,
       private readonly sessionService: SessionService,
     ) {}
     ```
  2. In `UsersService.deactivate(id: string, requestingUserId: string)`:
     ```typescript
     const updated = await this.update(id, { isActive: false });
     await this.sessionService.revokeAllSessions(id);
     return updated;
     ```
  3. In `UsersService.update`: If `dto.isActive === false`, also ensure `await this.sessionService.revokeAllSessions(id)` is triggered.
  4. In `UsersController.update`: Simplify to return `this.usersService.update(id, dto)`.
  5. Update `users.service.spec.ts` and `users.module.ts` providers/imports if needed.

---

### HARD-06: Align Distance Check-in Boundary Evaluation with Formatted Value

- **File**: `apps/api/src/attendance/attendance.service.ts`
- **Problem**:
  `distance > allowedRadius` checks the raw floating-point number, but formats `roundedDistance = Math.round(distance * 10) / 10`. A distance of `150.04m` produces `roundedDistance = 150.0m`, rejecting the request while reporting:
  `Check-in coordinates are 150m away from assigned warehouse (maximum 150m allowed)`.
- **Action**:
  1. In `AttendanceService.checkIn`:
     ```typescript
     const distance = haversineDistanceMeters(lat, lng, warehouse.gpsLat, warehouse.gpsLng);
     const allowedRadius = this.configService.get<number>('ATTENDANCE_RADIUS_M') ?? 150;
     const roundedDistance = Math.round(distance * 10) / 10;

     if (roundedDistance > allowedRadius) {
       throw new HttpException(
         {
           code: 'OUT_OF_RANGE',
           message: `Check-in coordinates are ${roundedDistance}m away from assigned warehouse (maximum ${allowedRadius}m allowed)`,
           details: { distanceM: roundedDistance, allowedRadiusM: allowedRadius },
         },
         HttpStatus.BAD_REQUEST,
       );
     }
     ```
  2. Add unit test in `attendance.service.spec.ts` testing the `150.04m` edge case (accepted) versus `150.06m` (rejected).

---

### HARD-07: Guard `error` Field on BullMQ Job Failures

- **File**: `apps/api/src/jobs/jobs.service.ts`
- **Problem**:
  `error: status === 'FAILED' && failedReason ? GENERIC_JOB_ERROR : null`. If a job fails with a null/empty `failedReason`, `error` is returned as `null`, violating contract expectations for failed jobs.
- **Action**:
  1. Update line 61 in `JobsService.getJobStatus`:
     ```typescript
     error: status === 'FAILED' ? GENERIC_JOB_ERROR : null,
     ```
  2. In `jobs.service.spec.ts`, add a unit test for a failed job with `failedReason: null` asserting `error === 'Report generation failed'`.

---

### HARD-08: Revoke Active Sessions on Password Reset and Change

- **Files**:
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/users/users.service.ts`
  - `apps/api/src/auth/auth.service.spec.ts`
- **Problem**:
  Resetting a forgotten password or changing an existing password leaves active refresh tokens valid in Redis for up to 7 days.
- **Action**:
  1. In `AuthService.resetPassword`:
     ```typescript
     await this.sessionService.revokeAllSessions(userId);
     ```
  2. In `UsersService.changePassword`:
     ```typescript
     await this.sessionService.revokeAllSessions(userId);
     ```
  3. Add test coverage in `auth.service.spec.ts` and `users.service.spec.ts` asserting that `revokeAllSessions` is called.

---

### HARD-09: Localized Date/Time Formatting in Excel Attendance Report

- **Files**:
  - `apps/api/src/attendance/attendance.worker.ts`
  - `apps/api/src/attendance/attendance.worker.spec.ts`
- **Problem**:
  `checkInAt: checkInDate.toISOString()` writes UTC strings (`06:00:00Z`). For Cairo staff, shift times are shifted by 2–3 hours from actual operational hours.
- **Action**:
  1. Add a helper in `apps/api/src/common/services/clock.service.ts` (or `attendance.utils.ts`):
     ```typescript
     export function formatLocalTimestamp(date: Date | string, timeZone = 'Africa/Cairo'): string {
       const d = typeof date === 'string' ? new Date(date) : date;
       if (isNaN(d.getTime())) return '-';
       return new Intl.DateTimeFormat('en-GB', {
         timeZone,
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hourCycle: 'h23',
       }).format(d);
     }
     ```
  2. In `AttendanceReportWorker`:
     ```typescript
     checkInAt: formatLocalTimestamp(item.record.checkInAt),
     checkOutAt: item.record.checkOutAt ? formatLocalTimestamp(item.record.checkOutAt) : '-',
     ```
  3. Update `attendance.worker.spec.ts` to assert the formatted Cairo timestamp.

---

## Step-by-Step Execution Sequence

1. **Phase 1: Shared Services & Redis Hardening (HARD-01, HARD-02, HARD-03)**
   - Update `clock.service.ts` caching.
   - Refactor `session.service.ts` to use Redis Sorted Sets (ZSET) for user session indexes.
   - Save `userId` in `rv:${tokenId}` and update `auth.service.ts` logging.
   - Update Redis stubs in tests. Run `pnpm --filter @alfahd/api test` to verify.

2. **Phase 2: Validation & Error Handling (HARD-04, HARD-06, HARD-07)**
   - Add `@MaxLength(255)` to `CreateEmployeeRequestDto` and `UpdateEmployeeRequestDto`.
   - Update boundary check in `attendance.service.ts`.
   - Update error fallback in `jobs.service.ts`.
   - Run unit tests for each module.

3. **Phase 3: Security & Clean Architecture (HARD-05, HARD-08)**
   - Wire `SessionService` into `UsersService` and move deactivation session revocation out of `UsersController`.
   - Add `revokeAllSessions` calls to `resetPassword` and `changePassword`.
   - Update `users.service.spec.ts` and `auth.service.spec.ts`.

4. **Phase 4: Excel Formatting (HARD-09)**
   - Add `formatLocalTimestamp` and update `attendance.worker.ts`.
   - Update `attendance.worker.spec.ts`.

---

## Verification & Quality Gates

Run the full verification suite in order:
```bash
# 1. Build types
pnpm --filter @alfahd/types build

# 2. Type check
pnpm --filter @alfahd/api typecheck

# 3. Lint check
pnpm --filter @alfahd/api lint

# 4. Unit tests
pnpm --filter @alfahd/api test

# 5. E2E tests
pnpm --filter @alfahd/api test:e2e
```

All 22 unit test suites and 4 E2E test suites must pass cleanly with 0 errors and 0 warnings.
