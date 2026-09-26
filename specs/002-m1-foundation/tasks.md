# Tasks: M1 Foundation

**Input**: Design documents from `/specs/002-m1-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**⚠️ CRITICAL IMPLEMENTOR NOTES — read before starting any task:**
- **Email**: Use `nodemailer` (NOT `@sendgrid/mail`). Constitution locks this choice.
- **ESM**: All relative imports in `apps/api/src/` MUST have `.js` extension (e.g., `import { Foo } from './foo.js'`).
- **Soft-delete**: NEVER issue `DELETE` statements. Use `is_active = false` for deactivation.
- **Build order**: Run `pnpm --filter @alfahd/types build` before anything that imports from `@alfahd/types`.
- **Password reset tokens**: Stored in Redis as `pwd_reset:{token}` → userId, TTL = 3600s. Single-use: delete key immediately after consumption.
- **Security alert logging**: On revoked token reuse (token exists in Redis as revoked/missing), log at WARN level with userId, IP, and timestamp.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure) — US1

**Purpose**: Initialize all infrastructure providers. These modules do NOT contain business logic — just connection wiring.

- [X] T001 [US1] Initialize Drizzle ORM database provider (connect to PostgreSQL via `pg`, export `db` instance) in `apps/api/src/database/database.module.ts`
- [X] T002 [P] [US1] Initialize Redis connection provider using ioredis (export `IORedis` client instance) in `apps/api/src/redis/redis.module.ts`
- [X] T003 [P] [US1] Initialize Nodemailer transporter provider (SMTP config from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) in `apps/api/src/email/email.module.ts`
  > **Note**: Use `nodemailer`, not `@sendgrid/mail`. Install with `pnpm --filter @alfahd/api add nodemailer` and `pnpm --filter @alfahd/api add -D @types/nodemailer`.
- [X] T004 [P] [US1] Register BullMQ module with the ioredis connection (no queues yet — just wire the module) in `apps/api/src/queue/queue.module.ts`
  > **Note**: BullMQ uses the same ioredis instance from T002. Import `BullModule.forRootAsync(...)` with the Redis connection options.

**Checkpoint (US1)**: Application starts, connects to PostgreSQL and Redis, Nodemailer transporter initializes without errors. US1 is now independently testable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and shared types that EVERY user story depends on. No story implementation starts until this is done.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T005 [P] Define `Role` enum and all shared DTOs (Auth + Users) as listed in `contracts/api.md` in `packages/types/src/index.ts`
  > **Note**: Build after editing: `pnpm --filter @alfahd/types build`. Downstream `apps/api` imports will fail until this build runs.
- [X] T006 Create Drizzle schema definitions for `users` and `warehouses` in `apps/api/src/database/schema/index.ts`
  - `users`: `id` (UUID PK), `email` (VARCHAR UNIQUE NOT NULL), `password_hash` (VARCHAR NOT NULL), `role` (Postgres ENUM: ADMIN | WAREHOUSE_STAFF | CS | TECHNICIAN), `is_active` (BOOLEAN DEFAULT true NOT NULL), `created_at` (TIMESTAMP DEFAULT now()), `updated_at` (TIMESTAMP DEFAULT now())
  - `warehouses` (stub): `id` (UUID PK), `name` (VARCHAR NOT NULL), `is_active` (BOOLEAN DEFAULT true NOT NULL), `created_at`, `updated_at`
  > **Note**: `is_active` is REQUIRED on both tables. Constitution Principle IV mandates soft-delete on ALL entities — no exceptions.
- [ ] T007 Generate and apply Drizzle migration for the schema defined in T006 in `apps/api/drizzle/`
  > **Command**: `pnpm --filter @alfahd/api db:generate` then `pnpm --filter @alfahd/api db:migrate`
  > **Status (2026-09-27)**: PARTIAL — `db:generate` done (`drizzle/0001_giant_the_executioner.sql`: `role` enum + `users` + `warehouses`, verified). `db:migrate` BLOCKED — Docker daemon is down, PostgreSQL unreachable. Run `pnpm infra:up` then `pnpm --filter @alfahd/api db:migrate` on a machine with Docker running.

**Checkpoint**: Database tables exist, `@alfahd/types` is built and exports `Role` enum — user story implementation can begin.

---

## Phase 3: User Story 2 — User Authentication & Session Management (Priority: P1)

**Goal**: Securely log in, stay authenticated via token refresh, and log out with Redis session invalidation.

**Independent Test**: Authenticate with valid credentials → receive tokens → access protected route → refresh → logout → confirm Redis token deleted.

- [X] T008 [P] [US2] Implement `SessionService` for Redis session operations (create, validate, revoke single session, revoke all sessions for a user) using key pattern `rt:{userId}:{tokenId}` with 7-day TTL in `apps/api/src/redis/session.service.ts`
  > **Note**: Revoking a session = deleting the Redis key. Revoke all sessions = `DEL` all keys matching `rt:{userId}:*` using `SCAN` (never `KEYS`).
- [X] T009 [US2] Implement `AuthService` with: `login()` (validate email+password via bcrypt cost 12, create access JWT 15m + refresh token UUID → stored via `SessionService`), `refresh()` (validate refresh token in Redis, issue new access JWT), `logout()` (delete refresh token from Redis via `SessionService`) in `apps/api/src/auth/auth.service.ts`
  > **Note**: Access token payload: `{ sub: userId, email, role }`. Use `@nestjs/jwt`. Refresh token is a UUID v4 — not a JWT.
- [X] T010 [P] [US2] Create Redis-backed rate limiting guard: max 5 login attempts per IP per 10-minute sliding window using Redis INCR + EXPIRE in `apps/api/src/auth/guards/rate-limit.guard.ts`
  > **Note**: Redis key pattern: `rl:login:{ip}`. On 6th+ attempt, throw `ThrottlerException` (429). Use centralized Redis — NOT in-memory — so the limit applies globally across all instances.
- [X] T011 [US2] Implement `AuthController` wiring T009 + T010 to HTTP endpoints in `apps/api/src/auth/auth.controller.ts`:
  - `POST /auth/login` → apply `RateLimitGuard` (T010), call `authService.login()`, return `LoginResponseDto`
  - `POST /auth/refresh` → call `authService.refresh()`, return `RefreshTokenResponseDto`
  - `POST /auth/logout` → require JWT (T013), call `authService.logout()`, return 200

**Checkpoint (US2)**: Login, refresh, and logout endpoints work. Rate limiting blocks the 6th attempt.

---

## Phase 4: User Story 3 — Role-Based Access Control (Priority: P1)

**Goal**: Lock endpoints behind JWT authentication and role guards; allow Admin to revoke any user's session.

**Independent Test**: Hit Admin-only endpoint with a TECHNICIAN token → get 403. Admin calls revoke-session → Redis keys deleted.

- [X] T012 [P] [US3] Implement JWT Passport strategy that validates the access token signature and decodes `{ sub, email, role }` payload in `apps/api/src/auth/strategies/jwt.strategy.ts`
  > **Note**: Secret from `ConfigService`. Strategy name: `'jwt'`. On invalid token: throw `UnauthorizedException` (401).
- [X] T013 [P] [US3] Implement `JwtAuthGuard` that wraps the Passport JWT strategy (T012) to use as a NestJS guard in `apps/api/src/auth/guards/jwt-auth.guard.ts`
  > **Note**: This is a SEPARATE file from the strategy. `JwtAuthGuard extends AuthGuard('jwt')`. Apply globally or per-route.
- [X] T014 [P] [US3] Create `@Roles(...roles: Role[])` decorator that attaches metadata to route handlers in `apps/api/src/auth/decorators/roles.decorator.ts`
  > **Note**: Use `SetMetadata(ROLES_KEY, roles)`. `ROLES_KEY` constant should be exported from this file.
- [X] T015 [US3] Implement `RolesGuard` that reads the `@Roles()` metadata (T014) and compares against `request.user.role` from the JWT payload (T012) in `apps/api/src/auth/guards/roles.guard.ts`
  > **Note**: If no `@Roles()` metadata is present, allow all authenticated users (guard passes). Deny with `ForbiddenException` (403) on mismatch.

**Checkpoint (US3)**: Any route decorated with `@Roles(Role.ADMIN)` rejects non-Admin tokens with 403.

---

## Phase 5: User Story 4 — User Account Management (Priority: P2)

**Goal**: Admin manages full user lifecycle; all users can change/reset passwords.

**Independent Test**: Admin creates user, soft-deactivates them (record remains in DB), deactivated user cannot log in, user resets password via email flow.

- [X] T016 [P] [US4] Implement `UsersService` with the following methods in `apps/api/src/users/users.service.ts`:
  - `create(dto: CreateUserDto)` → hash password (bcrypt cost 12), insert row, return `UserDto`
  - `findAll()` → return all user rows as `UserDto[]`
  - `findOne(id: string)` → return single user or throw `NotFoundException`
  - `update(id: string, dto: UpdateUserDto)` → update fields, return updated `UserDto`
  - `deactivate(id: string, requestingUserId: string)` → set `is_active = false`; if `id === requestingUserId` throw `BadRequestException('Admin cannot deactivate their own account')` (400)
  - `changePassword(userId: string, dto: ChangePasswordRequestDto)` → verify `oldPassword` via bcrypt, update `password_hash`
- [X] T017 [US4] Implement `POST /users/:id/revoke-session` (Admin only) that calls `sessionService.revokeAllSessions(userId)` to delete all `rt:{userId}:*` keys from Redis in `apps/api/src/users/users.controller.ts`
  > **Note**: This endpoint requires BOTH `JwtAuthGuard` (T013) AND `@Roles(Role.ADMIN)` + `RolesGuard` (T015). T016 must exist before this task.
- [X] T018 [US4] Implement `UsersController` for the core CRUD endpoints in `apps/api/src/users/users.controller.ts`:
  - `POST /users` → Admin only, calls `usersService.create()`
  - `GET /users` → Admin only, calls `usersService.findAll()`
  - `GET /users/:id` → Admin only, calls `usersService.findOne()`
  - `PATCH /users/:id` → Admin only, calls `usersService.update()` or `usersService.deactivate()`
  - `POST /users/change-password` → Any authenticated user, calls `usersService.changePassword()`
  > **Note**: All endpoints require `JwtAuthGuard`. Admin-only endpoints additionally require `@Roles(Role.ADMIN)` + `RolesGuard`.
- [X] T019 [US4] Implement `POST /auth/forgot-password` in `apps/api/src/auth/auth.controller.ts`:
  - Look up user by email; if not found return 200 anyway (do NOT reveal whether email exists)
  - Generate a UUID v4 reset token
  - Store in Redis: `SET pwd_reset:{token} {userId} EX 3600` (1-hour TTL, single-use)
  - Send email via Nodemailer with reset link containing the token
  > **Note**: Email template: plain text or HTML is acceptable. Reset link format: `{FRONTEND_URL}/reset-password?token={token}` (use `FRONTEND_URL` env var).
- [X] T020 [US4] Implement `POST /auth/reset-password` in `apps/api/src/auth/auth.controller.ts`:
  - Receive `{ token, newPassword }` (matches `ResetPasswordRequestDto`)
  - Look up `GET pwd_reset:{token}` in Redis → resolve to userId
  - If key missing/expired: throw `BadRequestException('Invalid or expired reset token')` (400)
  - Update user's `password_hash` via bcrypt cost 12
  - Delete key from Redis immediately: `DEL pwd_reset:{token}` (single-use enforcement)
  - Return 200 OK

**Checkpoint (US4)**: Full user lifecycle works. Deactivated users cannot log in. Self-deactivation returns 400.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] Implement security alert logging in `apps/api/src/auth/auth.service.ts`: when a refresh token lookup fails (key not in Redis for a previously-issued token), log at WARN level with `{ userId, ip, timestamp, reason: 'revoked_token_reuse' }` using the NestJS logger.
  > **Note**: The implementing model should distinguish between "token never existed" (normal expiry) and "token issued but now missing" (potential theft). Log only the latter.
- [X] T022 [P] Run `pnpm typecheck` and `pnpm lint` across the monorepo. Fix all errors before proceeding.
  > **Command**: `pnpm --filter @alfahd/api typecheck` then `pnpm --filter @alfahd/api lint`
- [ ] T023 Run all validation scenarios defined in `quickstart.md` end-to-end. Record p95 timing for auth endpoints.
  > **Status (2026-09-27)**: BLOCKED — Docker daemon is down in this environment, so PostgreSQL/Redis are unreachable and the API cannot boot. Code-level validation is green instead: `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm --filter @alfahd/api build` ✓ (29 files), unit tests 46/46 ✓ (incl. SessionService SCAN semantics + full Auth/Users DI wiring). Run T007-apply + this task after `pnpm infra:up` on a machine with Docker running.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all stories
- **Phase 3 (US2 Auth)**: Depends on Phase 2
- **Phase 4 (US3 RBAC)**: Depends on Phase 3 (needs Auth tokens to test guards)
- **Phase 5 (US4 User Mgmt)**: Depends on Phase 4 (needs `JwtAuthGuard` + `RolesGuard` for Admin-only routes)
- **Phase 6 (Polish)**: Depends on all stories complete

### Parallel Opportunities

- T001, T002, T003, T004 can all run in parallel (different files)
- T005 and T006 can run in parallel (different packages)
- T008, T010 in Phase 3 can run in parallel
- T012, T013, T014 in Phase 4 can run in parallel
- T016 in Phase 5 can start while T017 structure is being planned

---

## Implementation Strategy

1. Phase 1 → verify app boots and all connections succeed
2. Phase 2 → verify DB tables created and `@alfahd/types` builds clean
3. Phase 3 (US2) → verify login/refresh/logout with Redis KEYS check
4. Phase 4 (US3) → verify 403 on role mismatch, session revocation works
5. Phase 5 (US4) → verify full user lifecycle + password reset email flow
6. Phase 6 → typecheck/lint green, quickstart all pass
