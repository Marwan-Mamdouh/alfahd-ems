# Tasks: Argon2 & Enum Migration

**Branch**: `003-argon2-enum-migration` | **Date**: 2026-09-29
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the replacement dependency and remove the old one before any code changes.

- [X] T001 Remove `bcryptjs` and `@types/bcryptjs` from `apps/api/package.json` and install the `argon2` package — run `pnpm --filter @alfahd/api remove bcryptjs @types/bcryptjs && pnpm --filter @alfahd/api add argon2` from repo root
- [X] T002 Verify `pnpm --filter @alfahd/api build` still compiles (will fail on bcrypt imports — expected; confirms package.json change is correct before code changes begin)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Convert `@alfahd/types` first — all downstream API changes depend on the types package being rebuilt. This phase MUST complete before any Phase 3+ work.

**⚠️ CRITICAL**: The API build and all consumer code depend on `@alfahd/types`. Build types after every change in this phase.

- [X] T003 Convert `Role` enum to `as const` object + union type in `packages/types/src/index.ts` — replace `export enum Role { ADMIN = 'ADMIN', WAREHOUSE_STAFF = 'WAREHOUSE_STAFF', CS = 'CS', TECHNICIAN = 'TECHNICIAN' }` with `export const Role = { ADMIN: 'ADMIN', WAREHOUSE_STAFF: 'WAREHOUSE_STAFF', CS: 'CS', TECHNICIAN: 'TECHNICIAN' } as const; export type Role = (typeof Role)[keyof typeof Role];` — identifier `Role` must not change
- [X] T004 [P] Convert `TicketStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` — same identifier
- [X] T005 [P] Convert `TicketType` enum to `as const` + union type in `packages/types/src/index.ts` — members: `INSTALLATION`, `TECHNICAL_ISSUE`, `COMPLAINT`, `MAINTENANCE` — same identifier
- [X] T006 [P] Convert `TicketPriority` enum to `as const` + union type in `packages/types/src/index.ts` — members: `LOW`, `MEDIUM`, `HIGH`, `URGENT` — same identifier
- [X] T007 [P] Convert `RouterStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, `DECOMMISSIONED` — same identifier
- [X] T008 [P] Convert `RouterHolderType` enum to `as const` + union type in `packages/types/src/index.ts` — members: `WAREHOUSE`, `TECHNICIAN`, `CUSTOMER` — same identifier
- [X] T009 [P] Convert `IpStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `AVAILABLE`, `ASSIGNED`, `RESERVED`, `RETIRED` — same identifier
- [X] T010 [P] Convert `AttendanceStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `ON_TIME`, `LATE`, `ABSENT` — same identifier
- [X] T011 [P] Convert `CustomerStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `ACTIVE`, `INACTIVE`, `SUSPENDED` — same identifier
- [X] T012 [P] Convert `Department` enum to `as const` + union type in `packages/types/src/index.ts` — members: `WAREHOUSE`, `TECHNICAL`, `CUSTOMER_SERVICE`, `MANAGEMENT` — same identifier — preserve the existing `OI-02` comment above it
- [X] T013 [P] Convert `EmployeeStatus` enum to `as const` + union type in `packages/types/src/index.ts` — members: `ACTIVE`, `INACTIVE` — same identifier
- [X] T014 Build and verify `@alfahd/types` — run `pnpm --filter @alfahd/types build` from repo root; must exit 0 with no type errors (depends on T003–T013)
- [X] T015 Run API typecheck to confirm zero breaking changes from enum migration — run `pnpm --filter @alfahd/api typecheck` from repo root; must exit 0 (depends on T014)

**Checkpoint**: Foundation complete — `@alfahd/types` is fully migrated and all downstream consumers still compile. Phase 3 (password hashing) can now proceed.

---

## Phase 3: User Story 1 — New Passwords Hashed with Argon2id (Priority: P1) 🏁 MVP

**Goal**: Replace all `bcryptjs` imports and call sites in `apps/api` with `argon2`. Every password operation (create, reset, change-password, login verification) uses argon2id with OWASP default parameters.

**Independent Test**: Run `pnpm --filter @alfahd/api test`, then start the API, create a user, inspect the `password_hash` column — it must start with `$argon2id$`. Login with the correct password must succeed; login with a wrong password must return 401.

### Implementation for User Story 1

- [X] T016 [US1] Replace `BCRYPT_COST = 12` with `ARGON2_OPTIONS` constant in `apps/api/src/database/schema/mappers.ts` — add `export const ARGON2_OPTIONS = { memoryCost: 65_536, timeCost: 3, parallelism: 1 } as const;` and remove the `BCRYPT_COST` export; remove the `bcryptjs`-related import if present
- [X] T017 [US1] Swap `bcryptjs` for `argon2` in `apps/api/src/auth/auth.service.ts`:
  - Replace `import { compare, hash } from 'bcryptjs'` with `import { hash, verify } from 'argon2'`
  - Replace `import { BCRYPT_COST, toUserDto }` with `import { ARGON2_OPTIONS, toUserDto }`
  - In `login()`: replace `compare(password, user.passwordHash)` with `verify(user.passwordHash, password)` — **note argument order reversal: argon2.verify takes (hash, plaintext)**
  - In `resetPassword()`: replace `hash(newPassword, BCRYPT_COST)` with `hash(newPassword, ARGON2_OPTIONS)`
- [X] T018 [US1] Swap `bcryptjs` for `argon2` in `apps/api/src/users/users.service.ts`:
  - Replace `import { compare, hash } from 'bcryptjs'` with `import { hash, verify } from 'argon2'`
  - Replace `import { BCRYPT_COST, toUserDto }` with `import { ARGON2_OPTIONS, toUserDto }`
  - In `create()`: replace `hash(dto.password, BCRYPT_COST)` with `hash(dto.password, ARGON2_OPTIONS)`
  - In `changePassword()`: replace `compare(dto.oldPassword, user.passwordHash)` with `verify(user.passwordHash, dto.oldPassword)` — **argument order reversal**
  - In `changePassword()`: replace `hash(dto.newPassword, BCRYPT_COST)` with `hash(dto.newPassword, ARGON2_OPTIONS)`
- [X] T019 Run full build + typecheck to confirm no remaining `bcryptjs` references and all argon2 types resolve — run `pnpm --filter @alfahd/api build && pnpm --filter @alfahd/api typecheck` from repo root; both must exit 0 (depends on T016–T018)

**Checkpoint**: User Story 1 complete. All password operations now use argon2id. The API should start cleanly and accept/verify argon2id hashes.

---

## Phase 4: User Story 2 — Shared Type Contracts Stable After Enum Migration (Priority: P1)

**Goal**: Verify that all consumers of `@alfahd/types` — particularly `@IsEnum(Role)` runtime validation and dot-notation access like `Role.ADMIN` — work identically after the `as const` migration.

**Independent Test**: POST `/api/users` with `"role": "INVALID_ROLE"` → 400. POST with `"role": "ADMIN"` → 201. `pnpm --filter @alfahd/api typecheck` exits 0.

> Note: The actual code changes for this story were completed in Phase 2 (T003–T015). This phase validates the contract at runtime and confirms no consumer changes are needed.

### Implementation for User Story 2

- [ ] T020 [US2] Verify `@IsEnum(Role)` runtime behaviour is unchanged — start the API with `pnpm api:dev`, send `POST /api/users` with an invalid role value (e.g. `"role": "SUPERUSER"`) and confirm a 400 Bad Request is returned; send with `"role": "ADMIN"` and confirm 201 (depends on T014, T019)
- [X] T021 [US2] Verify dot-notation access compiles correctly — run `pnpm --filter @alfahd/api typecheck` and confirm zero errors related to `Role.ADMIN`, `Role.CS`, or any other enum member references in controllers, guards, and decorators (depends on T015)

**Checkpoint**: User Story 2 complete. All type contracts are stable — no consumer changes were needed.

---

## Phase 5: User Story 3 — Database Schema Values Remain Compatible (Priority: P2)

**Goal**: Confirm that Drizzle schema types accept the same string literal values as before, and that the existing `roleEnum` Drizzle `pgEnum` in `schema/index.ts` is unaffected.

**Independent Test**: `pnpm --filter @alfahd/api typecheck` exits 0 with no Drizzle schema errors. Start the API, create a user, query `SELECT password_hash, role FROM users LIMIT 1` — hash starts with `$argon2id$`, role is a valid string value.

### Implementation for User Story 3

- [X] T022 [US3] Confirm `pgEnum` in `apps/api/src/database/schema/index.ts` is unchanged — verify `roleEnum` still uses hardcoded string literals (`'ADMIN'`, `'WAREHOUSE_STAFF'`, `'CS'`, `'TECHNICIAN'`) and does NOT reference the `Role` TypeScript constant — no edit needed, this is a verification task (depends on T014)
- [X] T023 [US3] Run `pnpm --filter @alfahd/api typecheck` and confirm the Drizzle schema (`apps/api/src/database/schema/index.ts` and `mappers.ts`) produces zero type errors with the new `as const` `Role` type (depends on T015, T016)

**Checkpoint**: User Story 3 complete. Drizzle schema is fully compatible with the migrated types — no migration file needed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final gate validation across the full monorepo build chain.

- [X] T024 [P] Run the full pre-commit hook chain manually — `pnpm --filter @alfahd/types build && pnpm --filter @alfahd/api typecheck && pnpm --filter @alfahd/api lint && pnpm --filter @alfahd/api test` — all must exit 0
- [X] T025 [P] Confirm `bcryptjs` is fully absent — run `Select-String -Path apps/api/src/**/*.ts -Pattern 'bcryptjs'` (PowerShell) or equivalent; must return no matches
- [X] T026 [P] Confirm `BCRYPT_COST` is fully absent — run `Select-String -Path apps/api/src/**/*.ts -Pattern 'BCRYPT_COST'`; must return no matches
- [ ] T027 Run quickstart validation — follow [quickstart.md](./quickstart.md) Track A (A1–A7) and Track B (B1–B5) end to end; all scenarios must pass
- [X] T028 [P] Update the `Department` enum comment in `packages/types/src/index.ts` if needed — the `OI-02` unresolved placeholder comment above `Department` must still be present and accurate after T012

### Phase 6 Addendum — argon2id contract validation

- [X] T029 Add `apps/api/src/database/schema/mappers.spec.ts` covering the hashing contract so the assertions run in CI on every push rather than relying on manual checks
- [X] T030 Run the password flows end to end against the live database — hash format on insert, login with the correct password, rejection of a wrong password, and the change-password rotation (old password stops verifying, new one succeeds) all behave per the contract: 10/10 assertions pass
- [ ] T031 Run the quickstart HTTP scenarios against a locally started API — **blocked by an unrelated local environment conflict** (see below)

> **Local environment note (not a code defect, pre-existing).** A native PostgreSQL install is listening on port 5432 alongside the `alfahd_postgres` Docker container, so the app connects to the wrong server and `auth/login` returns 500 (`password authentication failed for user "alfahd"`). This is independent of the argon2 migration: `GET /` and `POST /auth/refresh` behave correctly, and the flows were validated directly against the container instead. Freeing port 5432 (stop the native Postgres service, or repoint `DATABASE_URL`) restores local HTTP testing. `argon2` itself installs and loads correctly on this host — `pnpm install --frozen-lockfile` completes with the install script succeeding, and no Visual Studio toolchain is required.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup: T001–T002)
  └→ Phase 2 (Foundation: T003–T015)  ← BLOCKS all user story phases
       ├→ Phase 3 (US1: T016–T019)    ← MVP; can start once Phase 2 complete
       ├→ Phase 4 (US2: T020–T021)    ← depends on T014 + T019
       └→ Phase 5 (US3: T022–T023)    ← depends on T014 + T015 + T016
            └→ Phase 6 (Polish: T024–T028)
```

### Within-Phase Dependencies

| Task | Depends on |
|------|-----------|
| T002 | T001 |
| T004–T013 | T003 (can run in parallel with each other after T003) |
| T014 | T003–T013 all complete |
| T015 | T014 |
| T016 | T015 (ARGON2_OPTIONS replaces BCRYPT_COST; API imports types) |
| T017 | T016 |
| T018 | T016 |
| T019 | T017, T018 |
| T020 | T014, T019 |
| T021 | T015 |
| T022 | T014 |
| T023 | T015, T016 |
| T024–T028 | T019–T023 all complete |

### Parallel Opportunities

```
# Phase 2 — after T003, all remaining enum conversions run in parallel:
T004 (TicketStatus) ──┐
T005 (TicketType)   ──┤
T006 (TicketPriority) ┤
T007 (RouterStatus) ──┤─→ T014 (build types) → T015 (api typecheck)
T008 (RouterHolderType)┤
T009 (IpStatus)     ──┤
T010 (AttendanceStatus)┤
T011 (CustomerStatus)─┤
T012 (Department)   ──┤
T013 (EmployeeStatus)─┘

# Phase 3 — T017 and T018 can run in parallel (different files):
T017 (auth.service.ts) ──┐
T018 (users.service.ts) ─┴→ T019 (build + typecheck)

# Phase 6 — T024, T025, T026, T028 can all run in parallel:
T024 (pre-commit chain) ──┐
T025 (bcryptjs absent)  ──┤→ T027 (quickstart validation)
T026 (BCRYPT_COST absent)─┤
T028 (Department comment)─┘
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3 only)

1. Complete **Phase 1** — swap dependency in `package.json`
2. Complete **Phase 2** — migrate all 11 enums in `@alfahd/types`, build and typecheck
3. Complete **Phase 3** — swap bcrypt call sites in `auth.service.ts`, `users.service.ts`, `mappers.ts`
4. **STOP and VALIDATE**: Run quickstart Track A (A1–A7) — password hashing works end to end
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → types fully migrated, API still compiles ✅
2. Phase 3 → password hashing fully migrated ✅ **(MVP)**
3. Phase 4 → runtime validation confirmed ✅
4. Phase 5 → Drizzle schema compatibility confirmed ✅
5. Phase 6 → full gate validation ✅

---

## Notes

- `[P]` = parallelizable — different files, no incomplete dependencies
- `[US1/2/3]` = traceability label mapping task to user story from spec.md
- **Critical**: `argon2.verify(hash, plaintext)` arg order is the reverse of `bcryptjs.compare(plaintext, hash)` — see T017 and T018 for the exact swap
- **Do not touch**: `apps/api/src/database/schema/index.ts` — the Drizzle `pgEnum` is a PostgreSQL DDL type independent of TypeScript enums
- **Do not touch**: `apps/web/` — no enum or password changes are needed in the web dashboard
- Commit after each phase checkpoint, not after every individual task
