# Implementation Plan: Web API Integration

**Branch**: `004-web-api-integration` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-web-api-integration/spec.md`

## Summary

Integrate the Next.js web dashboard with the NestJS backend API. Replace fake/mock authentication with real `POST /auth/login` calls, connect the dashboard and users pages to real data from `/auth/*` and `/users`, and implement secure token storage: the access token in memory, the refresh token in an `httpOnly` cookie set by the backend.

**Scope change (spec Revision (2))**: this began as frontend-only. It now includes a **bounded backend change** — cookie handling on `/auth/login`, `/auth/refresh`, `/auth/logout` and credentialed CORS — plus e2e coverage for auth, users CRUD, and the RBAC guards. No new endpoints are added and no schema changes are involved.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >= 22.12

**Primary Dependencies**: Next.js 16, React 19, Zustand 5, Axios 1.x, Tailwind CSS 4, Base UI (`@base-ui/react`) + shadcn/ui, TanStack Query 5 (already installed; the tasks keep the existing Axios pattern rather than migrating). Backend adds `cookie-parser`.

**Storage**: PostgreSQL 16 via Drizzle (existing, unchanged by this feature) · Redis 7 (existing session store)

**Testing**: Vitest unit (`*.spec.ts`) and e2e (`*.e2e-spec.ts`) in `apps/api`. `apps/web` has **no test runner configured** — it ships only `typecheck` (`tsc --noEmit`) and `lint`. Web behaviour is therefore verified through typecheck plus the `quickstart.md` manual scenarios, not automated component tests. Adding a test runner to the web package is out of scope here.

**Target Platform**: Web browser (Vercel deployment) against the API on Railway — **cross-origin**, which is what forces the cookie and CORS requirements

**Project Type**: Web application with a bounded backend change

**Performance Goals**: Login completes in < 3 seconds, dashboard KPI data loads in < 2 seconds, token refresh is transparent (< 500ms overhead)

**Constraints**: 
- **No new endpoints.** Use existing `/auth/*` and `/users` only.
- **Refresh token transport is cookie-first with body fallback.** The cookie must use `httpOnly`, `Path=/auth`, and `SameSite=None; Secure` in production (cross-origin Vercel↔Railway). `SameSite=Strict` MUST NOT be used. Local HTTP dev uses `SameSite=Lax` without `Secure`, selected by env value — `SameSite=None` is rejected without `Secure`, so one hard-coded policy breaks local cookie auth.
- **CORS must use an explicit allowlist, never `*`,** because credentialed requests reject a wildcard.
- The access token must be held in memory only (Zustand without persist) — never `localStorage`.
- Frontend must send `withCredentials: true`; without it the browser drops the cookie.
- Backend wire format: success → `{ data }` (no `success` flag), applied to **every** endpoint; errors → `{ statusCode, message, path, timestamp }`
- `UserDto` = `{ id, email, role, isActive, createdAt }` — no name/department fields; role value is `CS` (display as "Customer Service")
- `GET /users` returns the full array (no pagination) — client-side table only
- Must not break the existing pre-commit hook chain
- Shared contracts come from `@alfahd/types`; no duplicate definitions

**Scale/Scope**: 3 pages (Login, Dashboard, Users), 4 user roles, ~17 permissions, 3 endpoints touched on the backend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared Contracts First | ✅ PASS | Frontend imports types from `@alfahd/types` — no duplicate definitions |
| II. ESM + Drizzle Stack | ✅ PASS | The backend change touches `main.ts` and the auth controller only. No ORM or schema change; all relative imports keep their `.js` extension |
| III. Strict Quality Gates | ✅ PASS | Pre-commit chain runs: types build → api typecheck → format → lint → test |
| IV. Soft-Delete Everywhere | ✅ PASS | No delete operations; logout revokes a session, it does not delete a user |
| V. Split Deployment | ⚠️ REVIEW | The cookie changes the `/auth` wire contract, which M4 #54 is meant to freeze. This feature lands **before** that freeze, so it must be reconciled into the frozen contract rather than treated as a post-freeze change. Web stays on Vercel, API on Railway. |
| VI. Avoid TypeScript Enums | ✅ PASS | Use `as const` objects and string literal unions. Note the existing `Role` enum in `@alfahd/types` is grandfathered and already emits `CS`. |

**Gate Result**: ✅ PASS with one item flagged for the contract freeze (Principle V).

## Project Structure

### Documentation (this feature)

```text
specs/004-web-api-integration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
apps/api/                                  # bounded backend change
└── src/
    ├── main.ts                             # + enableCors (allowlist, credentials), cookieParser, cookie config
    ├── config/
    │   └── env.ts (or validation schema)   # + CORS_ORIGINS, COOKIE_SAME_SITE / COOKIE_SECURE
    └── auth/
        ├── auth.controller.ts              # + set cookie on login, read cookie on refresh, clear on logout
        ├── auth.service.ts                 # unchanged (no rotation)
        └── dto.ts                          # refreshToken becomes optional (cookie transport)

apps/web/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx    # Dashboard — 3 real KPIs + 1 placeholder
│   │   │   ├── employees/page.tsx    # "Users" page — real user data (route unchanged)
│   │   │   └── layout.tsx            # Dashboard layout (existing)
│   │   ├── auth/
│   │   │   └── login/page.tsx        # Login — replace fake auth with real API
│   │   ├── layout.tsx                # Root layout (existing)
│   │   └── page.tsx                  # Root page (existing)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── session-expiry-redirect.tsx   # Global session expiry handling
│   │   │   └── session-restore.tsx           # NEW — silent refresh on mount (FR-019)
│   │   ├── layout/ …                        # existing
│   │   ├── shared/ …                        # existing (DataTable, states)
│   │   └── ui/ …                            # shadcn/ui (existing)
│   ├── core/
│   │   ├── api/
│   │   │   ├── axios-instance.ts     # + request interceptor, withCredentials, cookie-based refresh
│   │   │   ├── endpoints.ts          # users paths, change-password path
│   │   │   └── types.ts              # aligned to real backend shapes
│   │   ├── auth/
│   │   │   ├── auth.store.ts         # memory-only access token, BroadcastChannel
│   │   │   ├── auth-events.ts
│   │   │   ├── guards.tsx            # RoleGuard
│   │   │   └── routes.ts
│   │   └── permissions/permissions.ts
│   ├── providers/query-provider.tsx
│   └── lib/utils.ts
├── .env.local                           # NEXT_PUBLIC_API_URL
├── next.config.ts
├── package.json
└── tsconfig.json

apps/api/test/                            # NEW — e2e coverage (spec R11)
├── auth.e2e-spec.ts
└── users.e2e-spec.ts
```

**Structure Decision**: The feature modifies existing pages and components within `apps/web`, and adds a bounded change to `apps/api`'s auth boundary plus a new e2e suite. No new packages or services are created. No database migration is required — this feature touches no table.

## Complexity Tracking

> **Principle V (Split Deployment) requires reconciliation.** The cookie change alters the `/auth` wire contract that M4 #54 freezes. It lands before that freeze, so it is incorporated into the frozen contract — but the change must be recorded so the API-contract-freeze task and the separate frontend developer are working from the documented dual-transport behaviour, not the superseded body-only description.
>
> **Cross-cutting risk — cookie/CORS failure modes are silent.** A missing `withCredentials`, a wildcard CORS origin, or `SameSite=None` over plain HTTP each produce the same symptom: refresh returns 401 and the app bounces to login on every page load, which reads as a frontend bug rather than a transport misconfiguration. The cookie attributes and CORS origin must therefore be asserted explicitly in tests rather than assumed to work.
