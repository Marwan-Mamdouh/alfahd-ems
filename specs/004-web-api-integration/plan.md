# Implementation Plan: Web API Integration

**Branch**: `004-web-api-integration` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-web-api-integration/spec.md`

## How to use this plan

This plan is written to be executed by a low-capability model with no prior context. Read these four rules before starting.

1. **Execute tasks in the numbered order given.** Tasks are not independent; several depend on files created or edited by earlier ones.
2. **Do exactly what each task says.** Every task names the files to touch, the intent, and how to verify. Do not add features, rename things, or "improve" code that is not mentioned.
3. **Run the verification line after every task.** If it fails, fix that task before moving on. Do not continue and fix later.
4. **If a task's instructions do not match the file you find**, stop and report it rather than improvising. Two tasks below have already been invalidated by upstream code that landed after this plan was written (T05 and T06).
5. **Some tasks name a "wrong answer" explicitly.** T01, T07, T08, and T12 each list the specific way to get them wrong that still typechecks and lints. Those lists are not warnings — they are decisions. If your reasoning leads you to a listed wrong answer, you have misunderstood something upstream; stop and report rather than proceeding.

> `checklists/delegation.md` is the reviewer gate for the tasks where guessing wrong produces code that passes every automated check while breaking authentication. Read it before starting.

Every task has a **Done when** line. Tick it only when verification passes.

---

## Summary

Replace the web dashboard's mock authentication and mock data with real calls to the existing NestJS backend. The dashboard gets a real login, a real session that survives a page reload, and two data-driven pages (dashboard KPIs and the users list).

## Scope reality check — read this first

The plan that previously existed in this file assumed the backend work was still to be done. **It is already done.** Commit `ee32f3b` ("feat: deliver refresh token as httpOnly cookie and enable credentialed CORS") shipped:

| Backend item | Status | File |
|---|---|---|
| Refresh cookie set on login, read on refresh, cleared on logout | **Done** | `apps/api/src/auth/auth.controller.ts` |
| Cookie attribute policy (env-driven, `httpOnly`, `SameSite`, fail-fast on `SameSite=None` without `Secure`) | **Done** | `apps/api/src/config/refresh-cookie.ts` |
| Credentialed CORS with explicit origin allowlist | **Done** | `apps/api/src/main.ts` |
| `cookie-parser` wired | **Done** | `apps/api/src/main.ts` |
| CORS/cookie env vars validated | **Done** | `apps/api/src/config/env.validation.ts` |
| E2E coverage for auth + users + RBAC guards | **Done** | `apps/api/test/auth.e2e-spec.ts`, `users.e2e-spec.ts` |
| Unit coverage for cookie policy | **Done** | `apps/api/src/config/refresh-cookie.spec.ts` |

**Do not re-implement any of the above.** A model that trusts the old plan will rebuild working code and risk regressions.

Exactly one backend change remains in scope: the cookie `Path` fix in T01.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >= 22.12, pnpm 12.6.0

**Primary Dependencies**: Next.js 16.3.4 (App Router), React 19.2.8, Zustand 5, Axios 1.x, TanStack Query 5 (installed but unused by these pages), Tailwind CSS 4, shadcn/ui + Base UI

**Storage**: PostgreSQL 16 via Drizzle and Redis 7 — **neither is modified by this feature**. No migration is required; this feature touches no table.

**Testing**: `apps/api` has Vitest (`pnpm --filter @alfahd/api test`, `test:e2e`). **`apps/web` has no test runner** — its only gates are `typecheck` (`tsc --noEmit`) and `lint` (ESLint flat config). All web verification in this plan is therefore typecheck + lint + a manual browser check. Do not add a test runner; that is out of scope.

**Target Platform**: Next.js dashboard on Vercel, API on Railway, **connected same-origin through a Next.js rewrite** (see below)

**Project Type**: Web application, with one small backend change (cookie `Path`)

**Performance Goals**: Login to dashboard in < 3s (SC-001); dashboard KPI data in < 2s; refresh overhead < 500ms

### The one architectural decision everything else depends on

Browser calls go to `/api/...` on the dashboard's own origin. `next.config.ts` rewrites `/api/:path*` to the real API base URL, server-side. Consequences:

- The refresh cookie is **same-origin**, so the browser stores it for the dashboard domain and Next.js middleware can read it. This is what makes FR-008 possible.
- `SameSite=Lax` is sufficient everywhere; `SameSite=None` is no longer required for the web client.
- The cookie `Path` must be `/`. RFC 6265 sends a cookie only on request paths it prefixes. `Path=/auth` never reaches `/api/auth/refresh` (breaks session restore). `Path=/api/auth` never reaches `/dashboard` (breaks the guard). Only `/` reaches both. **This is T01.**
- CORS is still enabled on the backend for the mobile app, but the dashboard no longer exercises it.

### Constraints

- **No new endpoints.** Use existing `/auth/*` and `/users` only.
- **Access token in memory only** — never `localStorage`, `sessionStorage`, or a JS-readable cookie.
- **Refresh token never in JavaScript** — it lives only in the `httpOnly` cookie.
- **Wire format**: success → `{ data: <payload> }`, no `success` flag, applied to every endpoint. Errors → `{ statusCode, message, path, timestamp }`.
- **`UserDto`** = `{ id, email, role, isActive, createdAt }`. No `name`, no `department`, no `status`. Role value is `CS`, not `CUSTOMER_SERVICE`.
- **`GET /users`** returns the full array. No pagination. Sorting/filtering is client-side.
- No `enum` keyword (Constitution §VI). Use `as const` objects or string literal unions.
- Backend relative imports must keep the `.js` extension (Constitution §II, ESM).
- Build order: `pnpm --filter @alfahd/types build` before anything that imports it.

### Known problem this plan must fix

`apps/web/src/core/api/types.ts` declares types that **contradict the real backend**:

| Declared in `apps/web` | Reality |
|---|---|
| `ApiResponse.success: boolean` | No `success` field exists on the wire |
| `Role` includes `"CUSTOMER_SERVICE"` | Backend emits `"CS"` |
| `AuthUser` has `name`, `department`, `warehouseId`, `status` | None of these exist on `UserDto` |

Left alone, these types make the UI render fields the server never sends (blank names, blank status). T07 replaces this file's contents with real imports from `@alfahd/types`.

## Constitution Check

*GATE: must pass before implementation starts. Re-check after the final task.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Shared Contracts First | ✅ PASS after T04 + T05 | `apps/web` does **not** currently depend on `@alfahd/types`; T004 adds the workspace dependency and T005 deletes the duplicated types. No hand-written API types remain. This is a correctness fix, not tidiness: the local types contradict the wire format. |
| II. ESM + Drizzle Stack | ✅ PASS | Only backend file touched is `refresh-cookie.ts` and its spec — no imports added. No ORM or schema change. |
| III. Strict Quality Gates | ✅ PASS | Every task has a verification line; pre-commit chain (types build → api typecheck → format → lint → test) stays green. |
| IV. Soft-Delete Everywhere | ✅ PASS | No deletes. Logout revokes a session; deactivation sets `isActive: false`. |
| V. Split Deployment | ⚠️ REVIEW | The `/auth` wire contract changes (cookie `Path`). This lands **before** the M4 #54 contract freeze, so it must be recorded in the frozen contract. The separate frontend developer codes against `contracts/api-contracts.md` — that file must be updated (T15) or they will implement against the stale `Path=/auth`. |
| VI. Avoid TypeScript Enums | ✅ PASS | No `enum` introduced. Role is imported from `@alfahd/types`, which already uses `as const`. |

**Gate result**: ✅ PASS, one item flagged for the contract freeze (Principle V).

## Project Structure

```text
apps/api/                                    # ONE file changes
├── src/config/
│   ├── refresh-cookie.ts                     # T01: REFRESH_COOKIE_PATH '/auth' → '/'
│   └── refresh-cookie.spec.ts                # T01: assertion must match new constant
└── test/auth.e2e-spec.ts                     # T01: verify cookie assertions still hold

apps/web/
├── next.config.ts                            # T03: add rewrites
├── .env.example / .env.local                 # T02: document both API vars
├── package.json                              # T07: add @alfahd/types
├── src/
│   ├── proxy.ts                              # T08: read the httpOnly cookie, drop the flag cookie
│   ├── app/
│   │   ├── layout.tsx                        # existing; mounts SessionRestore (T12)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # existing
│   │   │   ├── dashboard/page.tsx            # T13: 3 real KPIs + 1 placeholder
│   │   │   └── employees/page.tsx            # T15: real users list, relabelled "Users"
│   │   └── auth/
│   │       ├── login/page.tsx                # T14: real login
│   │       ├── forgot-password/page.tsx      # T16: MOVED from core/auth, real endpoint
│   │       └── reset-password/page.tsx       # T16: MOVED from core/auth, token from URL
│   ├── components/auth/
│   │   ├── session-expiry-redirect.tsx       # existing; T17 extends for BroadcastChannel
│   │   └── session-restore.tsx               # T12: NEW, refresh on mount
│   ├── core/
│   │   ├── api/
│   │   │   ├── axios-instance.ts             # T09: request interceptor + retry + cookie refresh
│   │   │   ├── endpoints.ts                  # T10: fix users paths, drop non-existent endpoints
│   │   │   └── types.ts                      # T07: delete wrong types, re-export from @alfahd/types
│   │   ├── auth/
│   │   │   ├── auth.store.ts                 # T11: memory-only, no persist, no refresh token
│   │   │   ├── auth-events.ts                # existing
│   │   │   ├── guards.tsx                    # existing (RoleGuard); verify T11
│   │   │   └── routes.ts                     # T08: refresh cookie name constant
│   │   ├── auth/forgot-password/page.tsx     # T16: moved OUT (no longer a route)
│   │   ├── auth/reset-password/page.tsx      # T16: moved OUT (no longer a route)
│   │   └── permissions/permissions.ts        # T07: Role values must use CS
│   └── components/shared/                    # existing, reused: DataTable, states
└── ...
```

**Structure decision**: modify existing pages in place; move two misplaced pages into `app/auth/`; add one new component. No new packages except the `@alfahd/types` workspace dependency.

---

## Tasks

### Phase 1 — Backend cookie path (blocks all web work)

#### T01: Change the refresh cookie `Path` to `/`

**Why**: With the `/api/*` rewrite, the browser-visible auth path is `/api/auth/*`. A cookie scoped to `/auth` is never sent there, so session restore fails on every page load. The middleware guard also needs to read the cookie on `/dashboard`. `Path=/` satisfies both.

**Files**:
- `apps/api/src/config/refresh-cookie.ts` — line 18
- `apps/api/src/config/refresh-cookie.spec.ts` — line 39 asserts the literal `'/auth'`
- `apps/api/test/auth.e2e-spec.ts` — check for path assertions (grep first)

**Change**: set `export const REFRESH_COOKIE_PATH = '/';` and update the comment above it to explain the RFC 6265 reasoning. Update the spec assertion to compare against the constant rather than a hardcoded literal if it does not already.

**Verify**:
```bash
pnpm --filter @alfahd/types build
pnpm --filter @alfahd/api test
pnpm --filter @alfahd/api test:e2e
```
All must pass. The existing spec suite asserts `REFRESH_COOKIE_PATH === '/auth'`; that assertion is expected to be updated by this task — if it still says `'/auth'` after your edit, you missed a file.

**Done when**: `refreshCookieOptions({NODE_ENV:'production'}).path === '/'` and the full api test + e2e suites pass.

---

### Phase 2 — Web foundation

#### T02: Document the two API environment variables

**Why**: The rewrite target must be a server-only variable, and the browser must no longer use an absolute API URL.

**Files**: `apps/web/.env.example`, `apps/web/.env.local`

**Ports — read this before running anything.** The API is on `3000` (`apps/api/.env` sets `PORT=3000`) and Next.js *also* defaults to `3000`. They collide. The dashboard must run on **`3001`**, and `API_URL` points back at `3000`.

**Change**:
- `apps/web/.env.local`: set `API_URL=http://localhost:3000` (server-only — the rewrite target, read by `next.config.ts`). Also set `PORT=3001` here so `pnpm dev:web` picks it up without extra flags.
- `apps/web/.env.example`: document `API_URL`, `PORT=3001`, and `NEXT_PUBLIC_APP_NAME`.
- **Remove `NEXT_PUBLIC_API_URL` entirely.** A `NEXT_PUBLIC_` value is inlined into the client bundle at build time, exposing the internal host to every user. The browser now uses the relative `/api` prefix instead (T03/T05).

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
grep -r NEXT_PUBLIC_API_URL apps/web    # must return nothing
```

**Done when**: `API_URL=http://localhost:3000` and `PORT=3001` are set in `apps/web/.env.local`, no `NEXT_PUBLIC_API_URL` reference remains anywhere in `apps/web`, and the dashboard starts on 3001.

---

#### T03: Add the `/api/*` rewrite

**Why**: The entire same-origin design depends on this. Without it the cookie is set by the API origin and is invisible to the dashboard.

**File**: `apps/web/next.config.ts` (currently 7 lines, no config beyond `devIndicators`)

**Change**: add an `async rewrites()` returning `{ source: '/api/:path*', destination: `${process.env.API_URL}/:path*` }`. Source must be `/api/:path*` so it matches the backend's unversioned routes (`/auth/login` → `/api/auth/login`). Do not add a version prefix — the spec chose unversioned paths.

**Verify**:
```bash
# The dashboard runs on 3001 (see T02); the API it rewrites to runs on 3000.
pnpm dev:web -- --port 3001
# then, in another terminal — hit the dashboard origin, not the API:
curl -i http://localhost:3001/api/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"whatever"}'
```
Expect a **401 from the backend** (not a 404 from Next.js). A 404 means the rewrite is missing or malformed. A 400/500 also proves the rewrite reached the backend.

**Done when**: `/api/auth/login` returns a backend response rather than a Next.js 404.

---

#### T04: Add `@alfahd/types` to `apps/web`

**Why**: Constitution §I. The dashboard must not hand-write API types, and its current types are wrong (see Known problem above).

**File**: `apps/web/package.json`

**Change**: add `"@alfahd/types": "workspace:*"` to `dependencies`. Build types before typechecking.

**Verify**:
```bash
pnpm install
pnpm --filter @alfahd/types build
pnpm --filter fahd-dashboard typecheck
```

**Done when**: `apps/web` resolves `@alfahd/types` and typecheck passes.

---

### Phase 3 — Auth core (do these before any page)

#### T05: Rewrite the axios instance

**Why**: The current interceptor has two defects and one missing piece. It reads `data.data.refreshToken` from the refresh response, which the backend does not return — so it overwrites state with `undefined` and forces a logout on the second 401. It has **no request interceptor**, so no ordinary request carries `Authorization: Bearer` (SC-002 is false today). And refresh sends the token in the body instead of using the cookie.

**File**: `apps/web/src/core/api/axios-instance.ts` (67 lines; read it first)

**Change**:
1. `baseURL` → `'/api'` (relative, goes through the rewrite). Keep `withCredentials: true`.
2. **Add** a request interceptor: read `accessToken` from `useAuthStore.getState()` and set `Authorization: Bearer <token>` on every request except `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`.
3. **Rewrite** `refreshAccessToken()`: `POST /api/auth/refresh` with **no body token** (the cookie carries it). Store only the returned `accessToken`. Do not read a `refreshToken` field — it does not exist.
4. Keep the existing single-flight `refreshPromise` and `_retry` guard — both are correct.
5. **Add** GET retry per FR-021: auto-retry `GET` only, max 2 attempts, ~300ms then ~900ms backoff, then reject. Do not retry `POST`/`PATCH`/`DELETE`. Must not interfere with the 401 refresh path.
6. Export a `logout()` helper that calls `/auth/logout` and clears the store.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
pnpm --filter fahd-dashboard lint
```
Behavioural check is deferred to T13/T15 manual verification.

**Done when**: typecheck and lint pass, and `grep -n "data.data.refreshToken" apps/web/src/core/api/axios-instance.ts` returns nothing.

---

#### T06: Rewrite the auth store

**Why**: The store currently persists the access token, the refresh token, and the user to `localStorage` under key `fahd-auth`, and writes a JS-writable `fahd-session` cookie. All of that is the XSS exposure this feature removes.

**File**: `apps/web/src/core/auth/auth.store.ts` (73 lines; read it first)

**Change**:
1. **Remove** the `persist` middleware and the `createJSONStorage` import entirely. No `localStorage`, ever.
2. **Remove** `refreshToken` from state and from `setSession`. The signature becomes `setSession(accessToken, user)`.
3. **Remove** both `document.cookie` writes.
4. Keep `clearSession()`, `selectIsAuthenticated`, `selectRole`.
5. Add an `isRestoring` flag (or equivalent) so the app can render a loading state during mount-time refresh (T12).

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Callers of `setSession` will now fail typecheck — that is expected. T14 and T12 update them.

**Done when**: typecheck failures are limited to `setSession` callers, and `grep -n "persist\|localStorage\|document.cookie" apps/web/src/core/auth/auth.store.ts` returns nothing.

---

#### T07: Replace the incorrect API types

**Why**: See Known problem. `ApiResponse.success` does not exist, `Role` uses `CUSTOMER_SERVICE` instead of `CS`, and `AuthUser` has four fields the backend never sends.

**Files**:
- `apps/web/src/core/api/types.ts` (46 lines)
- `apps/web/src/core/permissions/permissions.ts` (43 lines)

**Change**:
- Delete `AuthUser`, `Role`, `Department`, `EmployeeStatus`, and the `success` field from `types.ts`. Re-export `Role` and `UserDto` from `@alfahd/types`. Keep `ApiResponse<T>` as `{ data: T }` (no `success`, no `message`). Keep `ListQueryParams` if used; delete `PaginatedResponse` — `GET /users` has no pagination (R10).
- In `permissions.ts`, update every role array that says `"CUSTOMER_SERVICE"` to `"CS"` (`ips.view`, `customers.view`, `customers.manage`, `tickets.view`, `tickets.manage`). Import `Role` from `@alfahd/types`.
- Add a display-label helper mapping role → Arabic label, with `CS` → "خدمة العملاء". Never render the raw wire value.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
grep -rn "CUSTOMER_SERVICE" apps/web/src   # must return nothing
```

**Done when**: no `CUSTOMER_SERVICE` string remains anywhere in `apps/web/src`, and `name`/`department`/`status` no longer appear on any user type.

---

#### T08: Update the proxy guard to read the httpOnly cookie

**Why**: FR-008. The guard currently checks `fahd-session`, a JS-writable flag the user can set by hand. That is not an authentication control.

**Files**: `apps/web/src/proxy.ts`, `apps/web/src/core/auth/routes.ts`

**Cookie name — use this literal value, do not invent one**:

```ts
// apps/web/src/core/auth/routes.ts
export const REFRESH_COOKIE_NAME = "refresh_token" as const;
```

The source of truth is `REFRESH_COOKIE_NAME` in `apps/api/src/config/refresh-cookie.ts` (line 9). The name is `refresh_token` — lowercase with an underscore. If you are ever unsure, read that file rather than guessing; a wrong name compiles, lints, and silently never matches, so the guard redirects every user to login with no error anywhere.

**Change**:
- In `routes.ts`, replace the `SESSION_COOKIE_NAME` constant (currently `"fahd-session"`, **delete it**) with `REFRESH_COOKIE_NAME` as above. Keep `LOGIN_PATH` and `DASHBOARD_PATH`.
- In `proxy.ts`, read that cookie with `req.cookies.has(REFRESH_COOKIE_NAME)`. Logic stays the same shape: public route + cookie → redirect to dashboard; non-public route without cookie → redirect to login with `?redirect=`.
- **This is a presence check and nothing more.** Do **not** attempt to validate the token. The refresh token is an opaque Redis UUID, so middleware cannot verify it without a network call per navigation. A stale or revoked cookie passes this check and fails on the first real API call with 401, which then clears the session. That is the intended design — the API is the sole enforcement point (FR-009). Adding a validation call from middleware is a **wrong answer**: it adds latency to every navigation and still cannot be authoritative.
- Leave the `export const config = { matcher: [...] }` block unchanged. It correctly excludes `api`, so middleware does not run on API routes.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
pnpm dev:web
```
Then with no cookie, visit `http://localhost:3001/dashboard` (the dashboard runs on **3001** — see T02) → expect a redirect to `/auth/login?redirect=/dashboard`.

**Done when**: `grep -rn "fahd-session" apps/web/src` returns nothing, and an unauthenticated `/dashboard` visit redirects.

---

### Phase 4 — Pages

> **T13a comes before T13** — see Phase 4b. Until those two files are moved into `app/auth/`, editing them changes dead code.

#### T09: Wire the login page to the real endpoint

**Files**: `apps/web/src/app/auth/login/page.tsx` (158 lines)

**Change**:
- Replace the `setTimeout` mock handler with a real `POST /api/auth/login`.
- Call `setSession(accessToken, user)` — two arguments (T06).
- Do **not** store `refreshToken` even though the response body contains it; the cookie already carries it.
- On success, resolve the redirect target with a **same-origin guard** (FR-028):

```ts
function safeRedirect(raw: string | null): string {
  // Only same-origin relative paths. Rejects absolute URLs, protocol-relative
  // "//evil.example", and backslash-prefixed values that a browser normalises
  // to "//".
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}
router.push(safeRedirect(searchParams.get("redirect")));
```

  **Wrong answer:** `router.push(searchParams.get("redirect") ?? "/dashboard")` — a crafted link like `/auth/login?redirect=https://evil.example` sends an authenticated user off-site.
- On 401: show one generic message (Arabic, matching the UI language) — identical for unknown email and wrong password (FR-022). Do not branch on the status code.
- On 429: show the rate-limit message.
- Add controlled inputs for email and password so the values are readable.
- Remove the "وضع العرض التجريبي" demo-mode badge.
- Add a link to `/auth/forgot-password`. **Do this even though T13a has not run yet** — the link may 404 until then, and that is expected. Omitting it because the target is not yet a route leaves no path to recovery from the login page.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Manual: log in with real credentials → redirected to `/dashboard`, and DevTools → Application → Cookies shows `refresh_token` with `httpOnly: true`, `path: /`. Console check: `document.cookie` must **not** contain `refresh_token`; `localStorage.getItem('fahd-auth')` must be null.

**Done when**: all four console checks above hold, and no `fake-access-token` string remains in the file.

---

#### T10: Wire the dashboard KPIs

**Files**: `apps/web/src/app/(dashboard)/dashboard/page.tsx` (62 lines)

**Change**:
- The page is currently a **server component** rendering four hardcoded KPI cards showing `—`. Fetching requires `"use client"`.
- Fetch `GET /users` once; derive exactly three metrics: total users (length), active users (`isActive === true`), active technicians (`role === 'TECHNICIAN' && isActive === true`).
- Keep the **tickets** card as a static `—` placeholder with **no retry button** — it has no data source (R7/R8). The current four cards are: إجمالي الموظفين, فنيون نشطون, تذاكر مفتوحة, تنبيهات المخزون. Keep all four slots; the inventory one is also a no-data-source placeholder.
- On failure: all real KPI cards show the shared `ErrorState` **with** `onRetry`, and log to `console.error`. This is visibly different from the placeholder — that distinction is the point of R8.
- Log the **endpoint path and status code only** (FR-026). Do not log the access token, the refresh token, the cookie value, a password, or a response body containing user emails. There is no error-reporting service in this feature.
- On empty array `[]`: all three real cards show `—` (FR-023). The users page carries the precise empty signal.
- Reuse `LoadingState` from `@/components/shared/states` while loading (FR-010).
- Wrap in `RoleGuard permission="dashboard.view"`.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Manual with ≥1 admin user: three cards show real numbers. Stop the API and reload: three cards show an error state **with** a retry button; the placeholder card shows neither.

**Done when**: no hardcoded `MOCK_` data remains, and the error state and the placeholder are visually distinguishable.

---

#### T11: Wire the users list

**Files**: `apps/web/src/app/(dashboard)/employees/page.tsx` (226 lines — **the top 82 lines are a commented-out duplicate**; delete them)

**Change**:
- Fetch `GET /users`. Remove `MOCK_EMPLOYES`.
- Columns: email, role label (via the T07 helper — never raw `CS`), active flag, created date. **No name column** — `UserDto` has no name.
- Relabel the page "المستخدمون" (Users) and its descriptions. The route stays `/dashboard/employees` so bookmarks survive (R9).
- Client-side sort and filter only (R10). No server pagination — remove `TablePagination` usage.
- Reuse `DataTable` with its built-in `isLoading` / `error` / `onRetry` / `emptyTitle` props; pass `emptyTitle` for the empty case (FR-023).
- Wrap in `RoleGuard permission="employees.manage"`.
- The count badge reads from the fetched array, not a constant.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
grep -n "MOCK_EMPLOYES" apps/web/src/app/\(dashboard\)/employees/page.tsx   # must return nothing
```
Manual: the table lists real users; sorting by email reorders rows with no network call.

**Done when**: no mock data and no commented-out duplicate block remain, and the count matches the response length.

---

#### T12: Add mount-time session restore

**Why**: FR-019. With the access token in memory only, a page reload holds nothing. Without this, every refresh dumps the user at login.

**File**: `apps/web/src/components/auth/session-restore.tsx` (**create**)

**The user object problem — decided, do not re-open this.**

`POST /auth/refresh` returns `{ accessToken }` and **nothing else**. There is no `user` field, and **no profile endpoint exists** — `endpoints.ts` declares an `auth.me` entry pointing at `GET /auth/me`, but the backend implements no such route. Calling it returns 404.

The decision for this feature: **restore the token, and re-read the user from the JWT.**

```ts
// Decode the payload segment of the access token. It is NOT a security check —
// the server already verified the token. It is only a source for display fields.
function userFromToken(accessToken: string): UserDto | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;
  try {
    const { sub, email, role } = JSON.parse(atob(payload));
    return { id: sub, email, role, isActive: true, createdAt: "" };
  } catch {
    return null;
  }
}
```

So `setSession(accessToken, userFromToken(accessToken))`. `createdAt` is not in the JWT — render the users table's created-date column from `GET /users` (which the users page already fetches), not from the store.

**Wrong answers, both of which you must not do:**

- **Do not add a `user` field to the refresh response, or extend `RefreshTokenResponseDto`.** The contract in `contracts/api-contracts.md` is frozen for the M4 #54 gate. A frontend-side change to the backend contract is out of scope and will break the mobile client. If the profile turns out to be insufficient later, raise it as a separate spec change.
- **Do not call `GET /auth/me`.** It does not exist. This is a trap: the endpoint is already declared in `endpoints.ts`, so it looks available.

**Change**:
- A client component that, on mount, calls `POST /api/auth/refresh` **exactly once** (cookie transport, empty body — no `refreshToken` in the body).
- On 200: `setSession(accessToken, userFromToken(accessToken))` as above.
- On 401: `clearSession()` and leave the user on login. **No retry loop** — guard with a `useRef` so the call fires exactly once per page load, never twice.
- While `isRestoring` is true, render a full-page loader rather than children. This prevents a login-screen flash, because the restore is async and the guard reads the cookie before it resolves.
- Mount it in `src/app/layout.tsx` next to the existing `<SessionExpiryRedirect />`.
- Handle the race: if `clearSession()` was called (logout) while the restore was in flight, the late 200 response must **not** call `setSession`. Check `useAuthStore.getState().accessToken === null` before writing.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Manual: log in, press F5. You land on `/dashboard`, not `/auth/login`, and the Network tab shows exactly one `/api/auth/refresh` call. Repeat with the cookie deleted — you land on login, and there is **no** retry loop.

**Done when**: a reload with a valid cookie restores the session, and a reload without one produces exactly one refresh attempt.

---

#### T13: Wire forgot-password and reset-password

**Why**: FR-024. Both pages currently show a **fake confirmation** — `forgot-password` has a `TODO: Phase 2` comment and a submit handler that only sets local state, telling the user an email was sent while doing nothing.

**Prerequisite**: **T13a must be complete.** These files are only routes after they are moved into `app/auth/`. If you have not done T13a, the pages you are editing are dead files and both URLs still 404.

**Files**: the two pages now at `apps/web/src/app/auth/forgot-password/page.tsx` and `apps/web/src/app/auth/reset-password/page.tsx`

**Change**:
- `forgot-password`: replace the local-state mock with `POST /api/auth/forgot-password`. Show the **same** confirmation whether or not the email exists (the endpoint always returns `{ ok: true }`). Remove the `TODO: Phase 2` comment.
- `reset-password`: read `token` from `useSearchParams()`. `POST /api/auth/reset-password` with `{ token, newPassword }`. On 400 (expired/used token) show an explicit "this link is invalid or expired" message plus a link back to `forgot-password` — not a generic failure. Remove the `TODO (Phase 2)` comment.
- Keep the existing 8-character minimum, which matches the backend. Add **no** client-side rules the server does not enforce (FR-025) — a rule shown to the user but not enforced server-side produces a confusing rejection.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Manual: `http://localhost:3001/auth/forgot-password` loads and calls `POST /api/auth/forgot-password`. Submitting a registered and an unregistered email both show **identical** text. A reset link with a bad token shows the expired-link message.

**Done when**: both routes call their real endpoints, neither file contains `TODO` or `Phase 2`, and the two `forgot-password` inputs produce byte-identical output.

---

#### T14: Cross-tab logout via BroadcastChannel

**Why**: FR-014. With no token in `localStorage`, no `storage` event ever fires, so the mechanism previously assumed silently never triggers.

**File**: `apps/web/src/components/auth/session-expiry-redirect.tsx` (24 lines)

**Change**:
- Create a `BroadcastChannel('fahd-auth')`. Broadcast on `clearSession()` and on logout.
- On receiving a logout/session-expired message, clear local state and redirect to login (SC-007: within 5 seconds).
- Keep the existing `SESSION_EXPIRED_EVENT` listener — same-tab expiry still uses it.
- Clean up the channel on unmount.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
```
Manual: log in, open `/dashboard` in two tabs, log out in tab 1. Tab 2 redirects to login within ~5 seconds and issues no further authenticated calls.

**Done when**: cross-tab logout works and the channel is closed on unmount.

---

### Phase 4b — Routes (run before T13)

#### T13a: Move forgot-password and reset-password into the App Router

**Why**: PREREQUISITE for T13. Both page files live in `apps/web/src/core/auth/`, which is **not** an App Router directory — so they are not routes and return 404 today. `proxy.ts` already whitelists `/forgot-password` and `/reset-password`, and the backend emails links to `${FRONTEND_URL}/reset-password?token=…`, so both URLs are referenced by working code that leads nowhere.

**Do this task first, separately from T13.** Moving and wiring are different changes; mixing them makes a broken route hard to diagnose, and a model that skips this step will edit the files in place and still ship two 404s.

**Files**:
- **Move** `apps/web/src/core/auth/forgot-password/page.tsx` → `apps/web/src/app/auth/forgot-password/page.tsx`
- **Move** `apps/web/src/core/auth/reset-password/page.tsx` → `apps/web/src/app/auth/reset-password/page.tsx`
- Delete the emptied `apps/web/src/core/auth/forgot-password/` and `apps/web/src/core/auth/reset-password/` directories.

**Change**: none beyond the move. Keep the files byte-identical — they are still mocked, and T13 wires them. Do **not** create the destination directories with an `app/` path you invent: the route URL is derived from the directory path, so `app/auth/forgot-password` yields `/auth/forgot-password`, which matches `proxy.ts`.

**Verify**:
```bash
pnpm --filter fahd-dashboard typecheck
pnpm dev:web -- --port 3001
```
Open `http://localhost:3001/auth/forgot-password` → must return **200**, not 404. Before this task it returns 404.

**Done when**: both URLs return 200, and `grep -rn "core/auth/forgot-password\|core/auth/reset-password" apps/web/src` returns nothing.

---

### Phase 5 — Contract and validation docs

#### T15: Update the API contract document

**Why**: Principle V. A separate frontend developer codes against `contracts/api-contracts.md`. Leaving `Path=/auth` there guarantees they build a broken client, and the M4 #54 freeze will cement the error.

**File**: `specs/004-web-api-integration/contracts/api-contracts.md`

**Change**:
- Cookie table: `Path` → `/`. Add the RFC 6265 reason.
- `SameSite`: `Lax` for the web path (same-origin via rewrite); note `None` remains for mobile.
- Add the `/api/*` rewrite and its consequences: no CORS from the dashboard, no `NEXT_PUBLIC_API_URL` in the client bundle.
- Add the axios rules that were missing: GET-only auto-retry (2 attempts, ~300ms/~900ms), request interceptor behaviour.
- Add `POST /users/change-password` → 201 (it already flags this mismatch at line 264 — confirm the number rather than trusting the note).
- Add a note that login/refresh are rate-limited at 5 per 10 min per IP → 429.

**Verify**: re-read the document top to bottom; every claim must match `apps/api/src` and `apps/web/src` as they now stand.

**Done when**: no `Path=/auth` remains in the contracts folder, and the axios section documents the retry budget.

---

#### T16: Update quickstart with a working local setup

**File**: `specs/004-web-api-integration/quickstart.md` (212 lines)

**Change**:
- **Fix the port collision.** `apps/api/.env` sets `PORT=3000` and `apps/web/.env.local` sets the API URL to `http://localhost:3000`. Next.js also defaults to port 3000. Run the dashboard on **3001** (`pnpm dev:web -- --port 3001` or set `PORT=3001` in the web `.env.local`) and set `API_URL=http://localhost:3000`. The current doc cannot work as written.
- Update every scenario for the rewrite: `POST /api/auth/login`, not `POST /auth/login`.
- Scenario 1: assert cookie `path: /` and `httpOnly: true`.
- Scenario 3b: keep — it is the scenario that catches every cookie mistake.
- Add the troubleshooting rows that actually bite: refresh 401s after reload (check `Path=/`), logout not clearing the cookie (`clearCookie` path must match the set path), and `NEXT_PUBLIC_API_URL` no longer being the client URL.
- Add a scenario for forgot/reset password (T13), including the expired-token path.
- State plainly that `apps/web` has **no automated test runner**, so these scenarios are the verification for web work.

**Verify**: follow the setup from a clean checkout and confirm the dashboard loads on 3001 with the API on 3000 and login works.

**Done when**: the documented commands run as written, and no scenario references a bare `/auth/...` browser path.

---

#### T17: Final verification sweep

Run the full gate chain and the browser checks:

```bash
pnpm --filter @alfahd/types build
pnpm --filter @alfahd/api typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api test
pnpm --filter @alfahd/api test:e2e
pnpm --filter fahd-dashboard typecheck
pnpm --filter fahd-dashboard lint
```

Also confirm the delegation gate before starting, and do not begin until it passes:

```bash
# All items in the gate start unchecked — a reviewer marks them.
```

Read `checklists/delegation.md`. Its highest-value items (CHK003, CHK006, CHK007, CHK026) cover the two decisions a low-capability model would otherwise invent: the cookie name (T08) and the user object on reload (T12).

Then confirm, in the browser, each Success Criterion that has a manual check:

| Criterion | Check |
|---|---|
| SC-001 | Login → dashboard under 3s |
| SC-003 | No re-login prompt during a session, including after reload |
| SC-004 | 3 real KPIs + a retry-free placeholder |
| SC-005 | Users list real, client-side sort, no mock rows |
| SC-006 | Unauthenticated request blocked |
| SC-007 | Cross-tab logout within 5s |
| SC-009 | `localStorage`, `sessionStorage`, `document.cookie` contain no token |
| SC-010 | Reload restores; cleared cookie → login, no retry loop |
| SC-011 | GET retries ≤2; POST issues exactly 1 call |
| SC-012 | Empty `[]` → `—` on KPIs, empty state on users page |
| SC-013 | forgot-password text identical for known/unknown email |
| SC-014 | Reset succeeds; used/expired token shows expired message |

**Done when**: all commands pass and every row above is confirmed.

---

## Complexity Tracking

> **The backend was mostly already built.** T01 is the only backend task. A model that re-implements the cookie, CORS, or the e2e suite will introduce regressions in code that currently works — read the Scope reality check table before touching `apps/api`.

> **Cookie and CORS failures are silent.** A wrong `Path`, a missing `Secure`, or a wildcard origin all produce the same symptom: refresh returns 401 and the app bounces to login on every load, which reads as a frontend bug rather than a transport misconfiguration. T01 and the T16 troubleshooting table exist because this failure mode is invisible in code review.

> **`apps/web` has no test runner.** Web correctness rests on typecheck, lint, and the manual scenarios in `quickstart.md`. Do not add Vitest to `apps/web` — it is out of scope, and "add tests" is not a substitute for running T17.

> **The refresh response carries no user, and there is no profile endpoint.** `POST /auth/refresh` returns `{ accessToken }` only, and `GET /auth/me` — though declared in `endpoints.ts` — does not exist on the backend. T12 therefore decodes the user from the JWT. Both tempting wrong answers (extending the backend contract, or calling `/auth/me`) are called out explicitly in T12. A cheap model will otherwise reach for one of them, because `endpoints.ts` makes `/auth/me` look real.

> **Two tasks carry deliberate traps and name their wrong answers inline.** T08 (cookie name) and T12 (user object on reload) each have a specific way to get them wrong that typechecks cleanly: inventing a cookie name, and reading a `user` field or calling the non-existent `GET /auth/me`. `checklists/delegation.md` is the reviewer gate for these and four other high-delegation-risk tasks.