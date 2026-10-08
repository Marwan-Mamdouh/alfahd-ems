# Data Model: Argon2 & Enum Migration

**Feature**: `003-argon2-enum-migration` | **Date**: 2026-09-29

This migration introduces no new entities, tables, or columns. It modifies two existing data concerns: how passwords are stored and how shared domain constants are typed.

---

## 1. Password Hash

**Entity**: Stored credential on the `users` table (`password_hash` column — `varchar(255)`)

### Before

| Attribute | Value |
|-----------|-------|
| Algorithm | bcrypt |
| Format | PHC string — `$2b$12$<22-char-salt><31-char-hash>` |
| Parameter | cost factor = 12 |
| Produced by | `bcryptjs.hash(password, 12)` |
| Verified by | `bcryptjs.compare(plaintext, storedHash)` |
| Encoded params | No (cost factor is encoded in PHC, but library auto-detects) |

### After

| Attribute | Value |
|-----------|-------|
| Algorithm | argon2id |
| Format | PHC string — `$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>` |
| Parameters | `memoryCost: 65536`, `timeCost: 3`, `parallelism: 1` |
| Produced by | `argon2.hash(password, ARGON2_OPTIONS)` |
| Verified by | `argon2.verify(storedHash, plaintext)` |
| Encoded params | Yes — PHC string embeds all parameters; future tuning is non-breaking |

### Schema Impact

**None.** The `password_hash` column is `varchar(255)` — both bcrypt (≈60 chars) and argon2id PHC strings (≈97 chars) fit within this limit. No migration needed.

### Validation Rules

- Minimum password length: 8 characters (enforced at DTO layer — unchanged)
- Hash is always produced server-side; plaintext is never persisted

---

## 2. Shared Domain Constants (`@alfahd/types`)

**Package**: `packages/types/src/index.ts`

These are TypeScript-level type definitions only. They have no direct database representation — the database uses Drizzle `pgEnum` for the `role` column (a PostgreSQL DDL type with hardcoded string literals that are independently maintained in `schema/index.ts`).

### Conversion Pattern (applied to all 11 constants)

```
Before:  export enum X { A = 'A', B = 'B' }
After:   export const X = { A: 'A', B: 'B' } as const;
         export type X = (typeof X)[keyof typeof X];
```

### Entities Being Migrated

| Constant | Members | Consumers |
|----------|---------|-----------|
| `Role` | `ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECHNICIAN` | `auth.service.ts`, `users.service.ts`, `users.controller.ts`, `users/dto.ts` (×2 `@IsEnum`), `guards/roles.guard.ts`, `decorators/roles.decorator.ts`, `mappers.ts` |
| `TicketStatus` | `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` | Future milestone modules |
| `TicketType` | `INSTALLATION`, `TECHNICAL_ISSUE`, `COMPLAINT`, `MAINTENANCE` | Future milestone modules |
| `TicketPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | Future milestone modules |
| `RouterStatus` | `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, `DECOMMISSIONED` | Future milestone modules |
| `RouterHolderType` | `WAREHOUSE`, `TECHNICIAN`, `CUSTOMER` | Future milestone modules |
| `IpStatus` | `AVAILABLE`, `ASSIGNED`, `RESERVED`, `RETIRED` | Future milestone modules |
| `AttendanceStatus` | `ON_TIME`, `LATE`, `ABSENT` | Future milestone modules |
| `CustomerStatus` | `ACTIVE`, `INACTIVE`, `SUSPENDED` | Future milestone modules |
| `Department` | `WAREHOUSE`, `TECHNICAL`, `CUSTOMER_SERVICE`, `MANAGEMENT` | Future milestone modules |
| `EmployeeStatus` | `ACTIVE`, `INACTIVE` | Future milestone modules |

### Type Compatibility After Migration

| Usage Pattern | Before | After | Breaking? |
|---------------|--------|-------|-----------|
| `Role.ADMIN` | `Role.ADMIN` (enum member) | `'ADMIN'` (string literal) | No — same runtime value |
| `role: Role` annotation | Only `Role.ADMIN` accepted | `'ADMIN'` also accepted | No — more permissive |
| `@IsEnum(Role)` | Validates against enum object | Validates against `as const` object | No — same runtime shape |
| `import { Role }` | Value import | Value import | No — unchanged |
| `import type { Role }` | Type import | Type import | No — unchanged |
| DB column | pgEnum string values unchanged | pgEnum string values unchanged | No — independent |

### State Transitions

Not applicable — these are static constant sets with no lifecycle transitions.
