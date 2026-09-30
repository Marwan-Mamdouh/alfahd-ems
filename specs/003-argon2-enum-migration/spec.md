# Feature Specification: Argon2 & Enum Migration

**Feature Branch**: `003-argon2-enum-migration`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Password hashing strategy change (bcrypt → argon2id) and migrate TypeScript enums to as-const objects, driven by Constitution v2.2.0 Principles VI and Technology Stack Auth constraint."

## Clarifications

### Session 2026-09-29

- Q: Does FR-002 (legacy bcrypt support) extend to `changePassword`'s old-password verification — or only to login? → A: No legacy bcrypt support is needed at all. The database has zero existing users or admin accounts, so bcrypt can be removed entirely and replaced with argon2id directly. No dual-algorithm layer, no opportunistic rehashing.
- Q: Should the exported `as const` object and its derived union type share the same identifier name (e.g., both `Role`), or use separate names like `RoleValues` for the object and `Role` for the type? → A: Same identifier for both. The `as const` object is named `Role` and the union type is `type Role = (typeof Role)[keyof typeof Role]`. No call sites are updated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Passwords Are Hashed with Argon2id (Priority: P1)

When any password is created or changed (admin-created user, password reset, change-password), the system hashes it with the argon2id algorithm using OWASP-recommended parameters.

**Why this priority**: This is the core deliverable — replacing bcrypt with argon2id across every password operation in the system.

**Independent Test**: Can be fully tested by creating a new user, inspecting the stored hash to confirm it carries the argon2id algorithm identifier, and then verifying a successful login with the correct password.

**Acceptance Scenarios**:

1. **Given** an admin creates a new user with a password, **When** the user record is persisted, **Then** the stored hash uses the argon2id algorithm identifier.
2. **Given** a user resets their password via the reset-password flow, **When** the new password is saved, **Then** the stored hash uses the argon2id algorithm identifier.
3. **Given** a user changes their password via the change-password flow, **When** the new password is saved, **Then** the stored hash uses the argon2id algorithm identifier.
4. **Given** a user submits their correct password at login, **When** the system verifies the credential, **Then** the user is authenticated and valid tokens are returned.
5. **Given** a user submits an incorrect password at login, **When** the system verifies the credential, **Then** the system rejects the attempt with an "invalid credentials" response.

---

### User Story 2 - Shared Type Contracts Remain Stable After Enum Migration (Priority: P1)

The web dashboard and mobile app import type values (e.g., `Role.ADMIN`, `TicketStatus.PENDING`) from `@alfahd/types`. After the enum-to-const migration, all existing import paths, value references, and type annotations continue to work without any changes in consuming code.

**Why this priority**: Constitution Principle I ("Shared Contracts First") demands that the types package build must not break downstream consumers. A breaking change here blocks both frontend and mobile development.

**Independent Test**: Can be fully tested by building `@alfahd/types`, then building `apps/api` and `apps/web` — all must compile without errors. Existing tests must pass unchanged.

**Acceptance Scenarios**:

1. **Given** all enums in `@alfahd/types` have been replaced with `as const` objects and derived union types, **When** `pnpm --filter @alfahd/types build` is run, **Then** the build succeeds.
2. **Given** the types package is rebuilt, **When** `pnpm --filter @alfahd/api build` is run, **Then** the API build succeeds with no type errors.
3. **Given** a consumer references a value like `Role.ADMIN`, **When** the consumer is compiled, **Then** the reference resolves to the same string literal `'ADMIN'` as before.
4. **Given** a consumer uses a type annotation like `role: Role`, **When** the consumer is compiled, **Then** the type resolves to the same string union (`'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'`).
5. **Given** a runtime validator uses the `Role` object to validate an incoming value (e.g., `@IsEnum(Role)`), **When** validation runs, **Then** the validator correctly accepts valid role strings and rejects invalid ones — identical behavior to the enum.

---

### User Story 3 - Database Schema Values Remain Compatible (Priority: P2)

The PostgreSQL database stores string values (e.g., `'ADMIN'`, `'PENDING'`). After the migration, Drizzle schema references and all insert/update operations remain valid.

**Why this priority**: Data integrity assurance — the string values stored in the database must exactly match what the new `as const` objects define.

**Independent Test**: Can be fully tested by building the API, running unit tests, and confirming that Drizzle schema types accept the same string literal values as before.

**Acceptance Scenarios**:

1. **Given** the Drizzle schema references the new `as const` types, **When** a new row is inserted, **Then** the inserted value matches one of the allowed string literals.
2. **Given** the Drizzle schema is updated to reference the new `as const` types, **When** `pnpm --filter @alfahd/api typecheck` is run, **Then** no type errors are reported.

---

### Edge Cases

- What happens if the argon2id hashing library is unavailable or throws an unexpected error at runtime? The system must fail the operation with an appropriate error response rather than crashing.
- What happens when a consumer's code references a value like `Role.ADMIN` and the `as const` object is not exported with the exact identifier `Role`? This must not happen — the exported object identifier and the union type identifier must both keep their original names to avoid breaking `@IsEnum(Role)`, dot-notation access, and type annotations across all consumers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST hash all passwords (create, reset, change) using the argon2id algorithm with OWASP-recommended default parameters.
- **FR-002**: System MUST replace the `bcryptjs` dependency and all its imports with an argon2id-capable library in the API package. No bcrypt compatibility layer is required.
- **FR-003**: System MUST remove the `BCRYPT_COST` constant and replace it with argon2id parameter configuration using OWASP defaults.
- **FR-004**: System MUST replace all TypeScript `enum` declarations in `@alfahd/types` with `as const` objects and derived union types.
- **FR-005**: System MUST export each converted constant using the **same identifier** as the original enum (e.g., `Role`, `TicketStatus`) so that all dot-notation access (`Role.ADMIN`), type annotations (`role: Role`), and runtime validators (`@IsEnum(Role)`) continue to work without modification in consuming code.
- **FR-006**: System MUST export a derived union type for each converted enum using the same identifier as the type (e.g., `type Role = (typeof Role)[keyof typeof Role]`), ensuring type annotations in consumers remain valid.
- **FR-007**: System MUST ensure that `@alfahd/types` builds successfully and that all downstream packages (`@alfahd/api`, `fahd-dashboard`) pass their TypeScript build after the migration.
- **FR-008**: System MUST ensure all existing unit and e2e tests pass without modification after both migrations.
- **FR-009**: System MUST NOT require any database schema migration for either change — no new tables, columns, or data transforms are needed.

### Key Entities

- **Password Hash**: The stored credential for a user. After migration: always produced by argon2id with OWASP defaults. The `bcryptjs` dependency and its cost constant are fully removed.
- **Type Contract (`@alfahd/types`)**: The shared package exporting domain constants and types. Entities being migrated: `Role`, `TicketStatus`, `TicketType`, `TicketPriority`, `RouterStatus`, `RouterHolderType`, `IpStatus`, `AttendanceStatus`, `CustomerStatus`, `Department`, `EmployeeStatus`. Each transitions from `enum` to an `as const` object + derived union type, keeping the same exported identifier name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of passwords created after the migration carry the argon2id algorithm identifier in their stored hash (verifiable by inspecting the hash prefix of newly stored hashes).
- **SC-002**: The `bcryptjs` package and its type definitions no longer appear in `apps/api/package.json` after the migration.
- **SC-003**: All 11 TypeScript enums in `@alfahd/types` are converted to `as const` objects with no change to exported identifier names or string literal values.
- **SC-004**: The full monorepo build chain (`types build → api build → web build`) completes without errors after both migrations.
- **SC-005**: All existing unit and e2e tests pass with a 100% pass rate after the migration, confirming no regressions.
- **SC-006**: Password hashing and verification time remains within acceptable user-facing limits (login completes in under 3 seconds under normal load).

## Assumptions

- The database has zero existing user records. No existing bcrypt password hashes need to be supported or migrated. This allows a clean, direct replacement with no backward-compatibility layer.
- The `BCRYPT_COST` constant exported from `apps/api/src/database/schema/mappers.ts` is internal to the API only and can be replaced with argon2id parameter configuration without affecting the shared types package.
- The `as const` migration in `@alfahd/types` is a TypeScript-level change only; it does not affect the PostgreSQL schema or Drizzle migration files, because the database stores plain string values, not TypeScript enum runtime representations.
- The `@IsEnum(Role)` validator from `class-validator` (used in `apps/api/src/users/dto.ts`) accepts plain objects as well as TypeScript enums — passing the `as const` `Role` object to `@IsEnum` produces identical runtime validation behavior, provided the exported object identifier remains `Role`.
- The API is the only consumer that performs password operations; the web dashboard and mobile app never hash or verify passwords directly.
- The Drizzle schema in `apps/api/src/database/schema/` imports types from `@alfahd/types` for type annotations; these imports will continue to compile after the migration because exported names and string values are preserved.
