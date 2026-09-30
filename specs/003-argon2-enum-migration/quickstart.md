# Quickstart Validation Guide: Argon2 & Enum Migration

**Feature**: `003-argon2-enum-migration` | **Date**: 2026-09-29

Use this guide to validate the feature end-to-end after implementation. It covers the two independent validation tracks: password hashing and enum migration.

---

## Prerequisites

```powershell
# 1. Docker services must be running
pnpm infra:up

# 2. Types package must be built first (always)
pnpm --filter @alfahd/types build

# 3. Confirm bcryptjs is gone, argon2 is present
cat apps/api/package.json | Select-String "bcryptjs","argon2"
# Expected: argon2 present, bcryptjs absent
```

> **Note**: `argon2` is a native addon, but it ships prebuilt binaries for every supported platform and needs no compiler. It is verified working on both Windows and Linux. See [research.md](./research.md) RES-001.

---

## Track A — Password Hashing Migration

### A1. Full Build Passes

```powershell
pnpm --filter @alfahd/api build
```
**Expected**: Build completes with no errors. No import of `bcryptjs` in the output.

### A2. Typecheck Passes

```powershell
pnpm --filter @alfahd/api typecheck
```
**Expected**: Exit code 0, no type errors.

### A3. Unit Tests Pass

```powershell
pnpm --filter @alfahd/api test
```
**Expected**: All spec files pass. No references to `bcryptjs` in test output.

### A4. Hash Format Verification (manual spot-check)

Start the API dev server:
```powershell
pnpm api:dev
```

Create a user via the API:
```powershell
# POST /api/users  (requires ADMIN JWT)
# Check the password_hash column in the DB
```

Connect to the database and inspect the stored hash:
```sql
SELECT password_hash FROM users LIMIT 1;
```
**Expected**: Hash starts with `$argon2id$` — not `$2b$`.

### A5. Login Succeeds with Argon2id Hash

Using the created user's credentials, call `POST /api/auth/login`.
**Expected**: 200 response with `accessToken` and `refreshToken`.

### A6. Login Fails with Wrong Password

Call `POST /api/auth/login` with an incorrect password.
**Expected**: 401 response with `"Invalid credentials"`.

### A7. Change Password Flow

Call `PATCH /api/users/me/password` with correct `oldPassword` and a new `newPassword`.
**Expected**:
- 200 response
- Stored `password_hash` now reflects the new argon2id hash
- Login with `newPassword` succeeds; login with `oldPassword` fails

---

## Track B — Enum-to-`as const` Migration

### B1. Types Package Builds

```powershell
pnpm --filter @alfahd/types build
```
**Expected**: Build succeeds. `dist/index.js` exports `Role`, `TicketStatus`, etc. as runtime objects (not compiled enum objects — verify via `console.log(Role)` in a quick script if needed).

### B2. API Typecheck Passes

```powershell
pnpm --filter @alfahd/api typecheck
```
**Expected**: Exit code 0. No type errors from `Role`, `TicketStatus`, or any other migrated constant.

### B3. DTO Validation Works at Runtime

Start the API and send a request with an invalid role value:
```powershell
# POST /api/users  with body: { "role": "INVALID_ROLE", ... }
```
**Expected**: 400 Bad Request — `@IsEnum(Role)` validation rejects the invalid value.

Send with a valid role:
```powershell
# POST /api/users  with body: { "role": "ADMIN", ... }
```
**Expected**: 201 Created — `@IsEnum(Role)` accepts the valid string.

### B4. Full Monorepo Build Chain

```powershell
pnpm types:build
pnpm --filter @alfahd/api build
pnpm dev:web  # confirm web dashboard builds without type errors
```
**Expected**: All three complete without errors.

### B5. Pre-commit Hook Chain Stays Green

```powershell
pnpm --filter @alfahd/types build
pnpm --filter @alfahd/api typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api test
```
**Expected**: All commands exit with code 0 — identical to the pre-commit hook chain.

---

## Artifact References

- [Password Hashing Contract](./contracts/password-hashing.md) — ARGON2_OPTIONS values and call-site arg order
- [Data Model](./data-model.md) — PHC string format, schema compatibility, type compatibility table
- [Research](./research.md) — Library choice, OWASP parameters, `@IsEnum` compatibility proof, full call-site inventory
