# Implementation Plan: Argon2 & Enum Migration

**Branch**: `003-argon2-enum-migration` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-argon2-enum-migration/spec.md`

## Summary

Replace `bcryptjs` with the `argon2` npm package (argon2id, OWASP defaults) across all password operations in `apps/api`, and convert all TypeScript `enum` declarations in `packages/types/src/index.ts` to `as const` objects with derived union types — preserving every exported identifier name and string literal value so no consumer changes are required.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js ≥ 22.12 (ESM, `"type": "module"`)

**Primary Dependencies**:
- Replace: `bcryptjs@^3.0.3` + `@types/bcryptjs@^3.0.0` (removed)
- Add: `argon2` npm package (native Node.js addon, ESM-compatible named exports)
- Unchanged: `class-validator` (`@IsEnum` accepts plain objects — confirmed compatible with `as const` objects)

**Storage**: PostgreSQL 16 via Drizzle ORM. The `roleEnum` Drizzle `pgEnum` in `schema/index.ts` is a *PostgreSQL-native enum type* (separate from TypeScript enums) and is **not affected** by this migration.

**Testing**: Vitest (unit: `*.spec.ts`, e2e: `*.e2e-spec.ts`)

**Target Platform**: Railway (Linux), Docker Compose locally

**Project Type**: Monorepo — NestJS 12 REST API + shared types package

**Performance Goals**: Login completes in under 3 seconds under normal load (SC-006). argon2id at `memoryCost: 65536, timeCost: 3, parallelism: 1` typically hashes in ~100–300 ms on server hardware — well within target.

**Constraints**: ESM — all relative imports in `apps/api/src/` must carry `.js` extension. Named import style: `import { hash, verify } from 'argon2'` (the `argon2` package exports named functions). `BCRYPT_COST` constant in `apps/api/src/database/schema/mappers.ts` must be removed and replaced with argon2 options.

**Scale/Scope**: Two packages touched — `apps/api` (4 call sites: `auth.service.ts`, `users.service.ts`, `mappers.ts`, `package.json`) and `packages/types` (11 enums in `index.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Shared Contracts First | `@alfahd/types` exports preserve all identifier names and string values; build chain enforced | ✅ PASS |
| II. ESM + Drizzle Stack | `.js` extensions maintained; `argon2` package is ESM-compatible; Drizzle schema untouched | ✅ PASS |
| III. Strict Quality Gates | Pre-commit hook chain (types build → typecheck → format → lint → tests) must stay green | ✅ PASS — no bypass |
| IV. Soft-Delete Everywhere | No delete paths introduced | ✅ N/A |
| V. Split Deployment | No new services or deployment changes | ✅ N/A |
| VI. Avoid TypeScript Enums | This feature *implements* Principle VI — direct compliance | ✅ PASS |
| Auth stack | Constitution mandates argon2id (OWASP defaults) | ✅ This feature delivers exactly that |

**No gate violations.** No Complexity Tracking entry required.

## Project Structure

### Documentation (this feature)

```text
specs/003-argon2-enum-migration/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── password-hashing.md   ← Phase 1 output
└── tasks.md             ← Phase 2 (/speckit-tasks, NOT created here)
```

### Source Code (repository root)

```text
packages/types/
└── src/
    └── index.ts          ← Convert 11 enums → as const + union type

apps/api/
├── package.json          ← Remove bcryptjs + @types/bcryptjs; add argon2
└── src/
    ├── database/
    │   └── schema/
    │       └── mappers.ts    ← Replace BCRYPT_COST with ARGON2_OPTIONS
    ├── auth/
    │   └── auth.service.ts   ← Swap bcryptjs → argon2 (hash + verify calls)
    └── users/
        └── users.service.ts  ← Swap bcryptjs → argon2 (hash + compare calls)
```

**Structure Decision**: Monorepo — types package first (build gate), then API package. No new files, no migrations, no new modules.
