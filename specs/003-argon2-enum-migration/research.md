# Research: Argon2 & Enum Migration

**Feature**: `003-argon2-enum-migration` | **Date**: 2026-09-29

---

## RES-001: Argon2 npm Package — ESM Compatibility & API

**Decision**: Use the [`argon2`](https://www.npmjs.com/package/argon2) npm package (not `bcrypt`, not `bcryptjs`, not `argon2-browser`). Pinned to `^0.45.1` (latest stable; `1.0.0-alpha.1` is a prerelease and is out of scope).

**Rationale**:
- `argon2` is the canonical Node.js binding for the reference Argon2 C library. It is the most widely maintained package and is the one recommended by OWASP's Node.js cheat sheet.
- It ships native named exports (`hash`, `verify`, `argon2id`) via `argon2.cjs` — compatible with the repo's `"type": "module"` setting under `moduleResolution: nodenext` + `esModuleInterop`.
- No `@types/argon2` package required — types are bundled (`argon2.d.cts`).

**Rationale against alternatives**:
- `argon2-browser` — browser-only WASM build, not for Node.js.
- `@node-rs/argon2` — Rust-based binding that ships prebuilt binaries via `optionalDependencies` (no compiler needed). It works on every platform, including Windows without a C++ toolchain. It was used during implementation of this branch because `argon2` could not be built on the Windows dev host, but it is **not** the final choice — see the platform note below.
- Rolling our own wrapper — no value, adds maintenance burden.

**Platform note (resolved)**: `argon2` is a native addon and was initially suspected of being uninstallable on Windows, because the published `win32-x64` prebuild is mislabeled `argon2.glibc.node` and a first install attempt fell back to `node-gyp rebuild` (no Visual Studio C++ workload present). That fallback turned out to be a transient environment condition rather than a packaging problem: `node-gyp-build` does resolve the shipped `win32-x64` binary, `pnpm install --frozen-lockfile` now completes with the `install` script succeeding, and the full test suite including the argon2id contract spec passes on Windows with no compiler installed. CI (`ubuntu-latest`) and production (Railway) load the `linux-x64` prebuild the same way. No platform-specific workaround or code change is required.

---

## RES-002: OWASP Argon2id Parameters

**Decision**: Use the following parameters as the project's standard argon2 options constant:

```
memoryCost: 65536   // 64 MiB
timeCost:   3       // 3 iterations
parallelism: 1      // 1 thread
type:       argon2id
```

**Rationale**:
- These are OWASP's "common production" recommendation (2024–2025) targeting ~100–300 ms hashing time on server hardware.
- The `argon2` package encodes parameters into the PHC string it stores — if parameters are tuned upward later, `verify` will still correctly validate old hashes using the embedded parameters. Future-proof by design.
- `parallelism: 1` is correct for single-threaded Node.js event loop usage. Higher parallelism does not help in a single-process environment and risks thread contention.

**Constant replacement**: `BCRYPT_COST = 12` in `mappers.ts` is removed. Replacement is a shared options object:
```ts
export const ARGON2_OPTIONS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;
```
Both `auth.service.ts` and `users.service.ts` import `ARGON2_OPTIONS` from `mappers.ts` — the same single source of truth pattern already used for `BCRYPT_COST`.

---

## RES-003: `@IsEnum` Compatibility with `as const` Objects

**Decision**: `@IsEnum(Role)` from `class-validator` works identically with `as const` objects as it does with TypeScript enums — **no changes needed in DTO files**.

**Rationale**:
- `class-validator`'s `@IsEnum` accepts any object at runtime and validates that the incoming value is one of the object's own values (`Object.values(obj)`).
- TypeScript enums compile to plain objects. An `as const` object has the same runtime shape — both are `{ KEY: 'VALUE', ... }`. The validator cannot distinguish them.
- **Confirmed**: `@IsEnum(Role)` where `Role = { ADMIN: 'ADMIN', ... } as const` passes valid values (`'ADMIN'`) and rejects invalid ones — identical behaviour.
- **Requirement**: The exported constant **must** retain the identifier `Role` (not `RoleValues` or `RoleConst`) so `@IsEnum(Role)` and `Role.ADMIN` dot-notation in controllers/guards/decorators continue to work without modification. ✅ Confirmed in spec FR-005 and clarification Q2.

---

## RES-004: TypeScript `as const` Pattern — Dual Export

**Decision**: Use the **declaration merging** pattern — a `const` with the same name as a `type`:

```ts
// Before (enum):
export enum Role {
  ADMIN = 'ADMIN',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF',
  CS = 'CS',
  TECHNICIAN = 'TECHNICIAN',
}

// After (as const + union):
export const Role = {
  ADMIN: 'ADMIN',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  CS: 'CS',
  TECHNICIAN: 'TECHNICIAN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
// resolves to: 'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'
```

**Rationale**:
- TypeScript allows a `const` and a `type` to share the same identifier in the same scope — value and type namespaces are separate. This is the idiomatic "enum replacement" pattern in modern TypeScript.
- All existing usage patterns remain valid:
  - `import { Role } from '@alfahd/types'` — unchanged
  - `Role.ADMIN` — resolves to `'ADMIN'` (same as before)
  - `role: Role` type annotation — resolves to `'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'` (same assignability)
  - `@IsEnum(Role)` — passes the runtime `Role` object (same object shape as a compiled enum)
  - `import type { Role } from '@alfahd/types'` — still valid (only imports the type)

**Important nuance — string literal union assignability**: With TypeScript enums, a parameter typed `role: Role` only accepts `Role.ADMIN` (the enum member), not the raw string `'ADMIN'`. With `as const` + union type, `role: Role` accepts both `Role.ADMIN` **and** the raw string `'ADMIN'`. This is a **relaxation** of the type — it does not break any existing code (you can't have code that previously passed that now fails). It is strictly more permissive. This is the expected and desired behaviour for the project.

---

## RES-005: Drizzle `pgEnum` — Not Affected

**Decision**: The `pgEnum('role', [...])` in `apps/api/src/database/schema/index.ts` is a **PostgreSQL DDL enum type**, entirely separate from TypeScript's `enum` keyword. It is not touched by this migration.

**Rationale**:
- `pgEnum` operates at the database level; it defines a PostgreSQL `CREATE TYPE role AS ENUM (...)` column type. Its values are hardcoded string literals in the schema file — they do not reference the TypeScript `Role` enum at runtime.
- The Drizzle schema column `role: roleEnum('role').notNull()` types the column as `'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'` — exactly the same string union the new `as const` type produces. Full type compatibility is maintained.
- **No migration file needed** — the database schema is unchanged.

---

## RES-006: Call Site Inventory (Complete)

All locations that must be updated for the bcrypt → argon2 swap:

| File | Change |
|------|--------|
| `apps/api/package.json` | Remove `bcryptjs`, `@types/bcryptjs`; add `argon2` |
| `apps/api/src/database/schema/mappers.ts` | Remove `BCRYPT_COST = 12`; add `ARGON2_OPTIONS` object; remove `bcryptjs`-related comment if any |
| `apps/api/src/auth/auth.service.ts` | Replace `import { compare, hash } from 'bcryptjs'` → `import { hash, verify } from 'argon2'`; replace `BCRYPT_COST` → `ARGON2_OPTIONS`; replace `compare(pw, hash)` → `verify(hash, pw)` (note arg order flip); replace `hash(pw, BCRYPT_COST)` → `hash(pw, ARGON2_OPTIONS)` |
| `apps/api/src/users/users.service.ts` | Same import swap; replace all 3 hash/compare calls |

> ⚠️ **Critical arg-order difference**: `bcryptjs.compare(plaintext, hash)` vs `argon2.verify(hash, plaintext)` — the argument order is reversed. Both call sites must be updated carefully.

All locations that must be updated for the enum → `as const` migration:

| File | Change |
|------|--------|
| `packages/types/src/index.ts` | Convert 11 enums to `as const` + `type` (same identifiers, same values) |

No other files need changes — `@alfahd/types` consumers (`auth.service.ts`, `users.service.ts`, `users.controller.ts`, `users/dto.ts`, `auth/guards/roles.guard.ts`, `auth/decorators/roles.decorator.ts`, `mappers.ts`) all use the `Role` identifier in ways that are fully compatible with the new `as const` pattern.
