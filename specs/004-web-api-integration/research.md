# Research: Web API Integration

**Date**: 2026-10-02 (rewritten after backend reconciliation)
**Feature**: Web API Integration (004)

> **Supersession note.** The previous version of this file was written before the backend was reconciled against the real `apps/api` code. Two of its decisions (R-002 rotation, R-005 `storage` event) are now **wrong** and were marked SUPERSEDED rather than deleted, so the original reasoning is still auditable.

## R-001: Token Storage Strategy — CONFIRMED

**Decision**: Access token in memory (Zustand, no persist). Refresh token in an `httpOnly` cookie set by the backend.

**Rationale**:
- `localStorage` is readable by any injected script, so an XSS payload exfiltrates the token. `httpOnly` makes the cookie unreachable from JavaScript.
- The access token **must** stay JS-readable because it travels in an `Authorization: Bearer` header, which requires JS to attach it.

**Alternatives considered**:
- `localStorage` for both tokens — rejected: XSS exposure.
- `httpOnly` cookie for both — rejected: the access token needs to be readable to set the header.
- BFF pattern — rejected as over-engineering for one SPA consumer.

## R-002: Refresh Token Rotation — SUPERSEDED

**Decision (original)**: implement rotation on every refresh.

**Why it is superseded**: `AuthService.refresh()` (`apps/api/src/auth/auth.service.ts`) re-signs with the **same** `tokenId`. No rotation exists, and implementing it is not this feature's job. The spec records it as `FR-004 (DEFERRED, backend-owned)`.

**Consequence**: the frontend must not assume a new refresh token arrives. Reading `refreshToken` off the refresh response — which the existing interceptor does — sets it to `undefined` and forces a logout on the second 401.

## R-003: API Integration Pattern — CONFIRMED

**Decision**: reuse the existing Axios instance and correct its interceptors. No new HTTP client.

**Rationale**: the instance already has correct single-flight deduplication and a `_retry` guard. TanStack Query is installed and a `QueryProvider` is mounted, but migrating to it is a larger refactor than this feature warrants; the existing pages use direct calls.

**Alternatives considered**: React Query / SWR — rejected as scope creep.

## R-004: Dashboard KPI Data Strategy — CONFIRMED

**Decision**: derive three KPIs from `GET /users`; show static placeholders for KPIs with no endpoint.

**Rationale**: the backend implements only `/auth/*` and `/users`, so ticket and inventory KPIs have no data source. Creating endpoints is out of scope.

**Consequence**: "no data source" and "fetch failed" are **different states** — only the latter offers retry. Conflating them was a real defect in the earlier spec.

## R-005: Cross-Tab Session Expiry — SUPERSEDED

**Decision (original)**: use the `storage` event.

**Why it is superseded**: the `storage` event fires only on writes to `localStorage` from *other* documents. Once tokens are memory-only (R-001), no such write ever happens, so a `storage` listener **silently never fires**. The mechanism is not merely suboptimal — it is inert.

**Decision (current)**: `BroadcastChannel`.

## R-006: Form Data Preservation — CONFIRMED

**Decision**: preserve in-progress form data in React state only; never in `localStorage`.

**Rationale**: no form in the current scope (login, dashboard, users list, password recovery) holds sensitive data, but persisting to `localStorage` would reintroduce exactly the exposure R-001 removes.

## R-007: Same-Origin Transport — NEW (drives most of the plan)

**Decision**: add a Next.js `rewrites` entry mapping `/api/:path*` to the API base URL, so the browser never talks to Railway directly.

**Rationale**: the spec requires the proxy guard (middleware) to make an auth decision before rendering. A cookie set by the Railway origin is invisible to middleware on the Vercel origin — different cookie jar. The rewrite makes the refresh cookie **same-origin**, which is the only way FR-008 is implementable.

**Alternatives considered**:
- Keep cross-origin and drop the middleware guard — rejected: it introduces a login flash on every page load and loses the redirect-with-`redirect`-param behaviour.
- Duplicate the cookie across both origins — rejected: two credentials for one session is a footgun with no benefit.

**Consequences** (each one is a task in `plan.md`):
- The cookie `Path` must be `/`. RFC 6265 sends a cookie only on request paths it prefixes: `/auth` never matches `/api/auth/*` (breaks restore), `/api/auth` never matches `/dashboard` (breaks the guard).
- `SameSite=Lax` suffices; `SameSite=None` is no longer needed for the web client.
- `NEXT_PUBLIC_API_URL` must not remain the client base URL — a `NEXT_PUBLIC_` value is inlined into the browser bundle and would leak the internal host.

## R-008: Retry Policy — NEW

**Decision**: auto-retry idempotent `GET`s only — 2 attempts, ~300ms then ~900ms backoff. Never auto-retry `POST`/`PATCH`/`DELETE`.

**Rationale**: replaying a mutation after a network timeout can duplicate writes, and the backend has no idempotency-key support to make replay safe. A manual retry control stays available on every error state.

## R-009: Empty vs Placeholder — NEW

**Decision**: an empty-but-successful `GET /users` shows the `EmptyState` component on the users page, and `—` on all three real dashboard KPI cards.

**Rationale**: an empty array is a legitimate first-run and post-migration state; rendering a bare table reads as a broken page. Accepted tradeoff: the dashboard does not distinguish "no data source" from "zero records", so the users page carries the precise signal.

## R-010: Password Recovery in Scope — NEW

**Decision**: wire `forgot-password` and `reset-password` to the real endpoints.

**Rationale**: the backend already implements both. Both page files exist but live in `src/core/auth/` — **not under `app/`, so they are not routes** and currently 404. `proxy.ts` already whitelists both paths and the backend emails links to `${FRONTEND_URL}/reset-password?token=…`, so a user following a reset email today hits a dead end. A reachable page that falsely confirms "email sent" is worse than a 404.

## R-011: Login Non-Enumeration — NEW

**Decision**: one generic message for both unknown-email and wrong-password failures.

**Rationale**: a distinguishable response turns login into an oracle for enumerating staff accounts. `forgot-password` already returns success unconditionally; login should not be the outlier.

## R-012: Shared Types Dependency — NEW

**Decision**: add `@alfahd/types` as a `workspace:*` dependency of `apps/web` and delete the dashboard's hand-written API types.

**Rationale**: Constitution §I. It is also a correctness fix, not just hygiene — `apps/web` currently declares `success: boolean` on `ApiResponse` (no such field), `"CUSTOMER_SERVICE"` in `Role` (backend emits `"CS"`), and an `AuthUser` with `name`/`department`/`status` (none exist on `UserDto`). Every one of those renders blank or wrong data in the UI.

## Open Item (not blocking)

Client-side logging of fetch failures has no specified destination or severity (spec checklist `api.md` CHK019). Deferred deliberately: it changes no architecture and no acceptance test. Logging goes to `console.error` in the interim.