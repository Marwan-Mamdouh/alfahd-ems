# Password Hashing Contract

**Feature**: `003-argon2-enum-migration` | **Scope**: Internal API contract — `apps/api` password operations

This contract defines the interface for all password hashing and verification operations after the migration. It is an **internal** contract consumed only by `AuthService` and `UsersService` — it is not exposed directly to API clients.

---

## Hashing Contract

**Operation**: Hash a plaintext password for storage

**Inputs**:
- `plaintext: string` — the user-supplied password (min 8 chars, enforced upstream by DTO)

**Output**:
- `Promise<string>` — a PHC-formatted argon2id hash string

**PHC String Format**:
```
$argon2id$v=19$m=65536,t=3,p=1$<base64url-salt>$<base64url-hash>
```

**Parameters (ARGON2_OPTIONS)**:

| Parameter | Value | Notes |
|-----------|-------|-------|
| `memoryCost` | `65536` (64 MiB) | Primary resistance to GPU/ASIC attacks |
| `timeCost` | `3` | Iterations |
| `parallelism` | `1` | Threads — appropriate for single-process Node.js |
| `type` | `argon2id` | Default when using ARGON2_OPTIONS; set explicitly if needed |

**Constant location**: `apps/api/src/database/schema/mappers.ts`
```ts
export const ARGON2_OPTIONS = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;
```

---

## Verification Contract

**Operation**: Verify a plaintext password against a stored hash

**Inputs**:
- `storedHash: string` — the PHC string retrieved from the database
- `plaintext: string` — the user-supplied password to verify

**Output**:
- `Promise<boolean>` — `true` if the plaintext matches the stored hash, `false` otherwise

**Argument order**: `verify(storedHash, plaintext)` — note this is **reversed** relative to `bcryptjs.compare(plaintext, storedHash)`.

**Error handling**: If the stored hash is malformed or uses an unrecognized algorithm prefix, `argon2.verify` **throws** (e.g. `Decoding failed` for a bcrypt-format hash) rather than returning `false`. Since this migration removed all bcrypt support (zero legacy rows exist), a throw indicates corrupted or foreign data, not a wrong password. Call sites let the exception propagate, which the NestJS exception filter surfaces as a 500 rather than a 401 — acceptable for a data-corruption case, but revisit if legacy rows are ever introduced.

---

## Contract Tests

`apps/api/src/database/schema/mappers.spec.ts` locks this contract in CI and asserts: the OWASP parameter values, the `$argon2id$` PHC prefix, embedded `m=65536,t=3,p=1` parameters, hash length within the `varchar(255)` column limit, `verify(hash, plaintext)` returning `true`/`false` correctly, per-hash salt uniqueness, and old hashes staying valid after a parameter retune.

> These tests require the native `argon2` addon to load. It is verified passing on both Windows and Linux (CI, production, Docker).

---

## Call Sites

| Service | Method | Operation |
|---------|--------|-----------|
| `UsersService.create` | Admin creates user | hash |
| `AuthService.login` | User logs in | verify |
| `AuthService.resetPassword` | Password reset flow | hash |
| `UsersService.changePassword` | User changes own password (verify old, hash new) | verify + hash |

---

## Removed Contract Elements

The following are removed and must not appear in any new code:

- `import { hash, compare } from 'bcryptjs'`
- `BCRYPT_COST` constant
- Any reference to `bcryptjs` or `@types/bcryptjs`
