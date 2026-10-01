# Tasks: Web API Integration

**Input**: `specs/004-web-api-integration/spec.md` + `plan.md`
**Scope**: Frontend integration plus a **bounded backend change** (refresh cookie + credentialed CORS) and new backend e2e coverage. No new endpoints. No schema migration.
**Base URL**: `process.env.NEXT_PUBLIC_API_URL` (e.g. `http://localhost:3000`). No versioning prefix.

> **This file was regenerated.** The previous version assumed a frontend-only scope with body-based refresh. Spec Revision (2) moved the refresh token into an `httpOnly` cookie, which invalidated old T005 ("Do NOT switch to cookie transport"), T007 (keep the refresh token in memory), T009 (`storage`-event cross-tab sync), and the note forbidding changes to `apps/api/`.

## Key Decisions (read once, then build)

- **Access token** → Zustand memory only. No `persist` middleware. Never `localStorage`, never a JS-visible cookie.
- **Refresh token** → `httpOnly` cookie set by the backend. The frontend never reads, stores, or writes it. It is sent automatically by the browser when requests are credentialed.
- **Refresh transport is dual**: `POST /auth/refresh` prefers the cookie, falls back to the request body (mobile keeps `expo-secure-store`/bearer).
- **No rotation in this feature.** Refresh returns a new access token only; the refresh token stays valid until logout or revocation.
- **Cookie attributes are env-driven** (R3): `SameSite=None; Secure; Path=/auth` in production; `SameSite=Lax`, no `Secure`, on local HTTP. `Path=/auth` keeps it off `/users`.
- **CORS uses an explicit allowlist with `credentials: true`.** Never `*`.
- **Frontend sends `withCredentials: true`** — without it the browser drops the cookie and refresh 401s.
- Backend role value is **`CS`**, not `CUSTOMER_SERVICE`. Display strings never go to the backend.
- `GET /users` returns the **full array**. Sort/filter client-side. No server pagination.
- Dashboard shows **3 real KPIs** (total users, active users, active technicians) + **1 placeholder** (tickets, no retry control).
- The page at `/dashboard/employees` is labelled **"Users"** — `UserDto` has no employee fields until M2.

## Files You Will Touch

**Backend**
- `apps/api/src/main.ts`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/config/refresh-cookie.ts` *(new)*
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/dto.ts`
- `apps/api/.env.example`

**Frontend**
- `apps/web/src/core/api/types.ts`
- `apps/web/src/core/api/axios-instance.ts`
- `apps/web/src/core/api/endpoints.ts`
- `apps/web/src/core/auth/auth.store.ts`
- `apps/web/src/components/auth/session-restore.tsx` *(new)*
- `apps/web/src/components/auth/session-expiry-redirect.tsx`
- `apps/web/src/app/auth/login/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- `apps/web/src/app/(dashboard)/employees/page.tsx`
- `apps/web/src/proxy.ts`

---

## Phase 1: Setup

**Purpose**: Env and types build so the app runs.

- [X] T001 Create `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3000`
- [X] T002 Run `pnpm --filter @alfahd/types build` and confirm `packages/types/dist/` exists

**Checkpoint**: `packages/types/dist/` exists; `apps/web/.env.local` present.

---

## Phase 2: Backend — refresh cookie + CORS *(blocks all frontend session work)*

**Goal**: The backend can deliver a refresh token to the browser that JavaScript cannot read, and can accept it back cross-origin.
**Independent Test**: `POST /auth/login` returns a `Set-Cookie` with the documented attributes; `POST /auth/refresh` succeeds with only that cookie and no body; `POST /auth/logout` clears it.

- [X] T003 [P] Add `cookie-parser` to `apps/api` (`pnpm --filter @alfahd/api add cookie-parser` and `@types/cookie-parser` as a dev dep)
- [X] T004 [P] Extend `apps/api/src/config/env.validation.ts` with `CORS_ORIGINS` (optional string, defaults to `FRONTEND_URL`) and `REFRESH_COOKIE_SAME_SITE` (optional enum `lax|none`, default derived from `NODE_ENV`) and `REFRESH_COOKIE_SECURE` (optional coerced boolean, default derived from `NODE_ENV`). Reuse the existing `NODE_ENV` and `FRONTEND_URL` keys — do not duplicate them.
- [X] T005 Create `apps/api/src/config/refresh-cookie.ts` exporting `REFRESH_COOKIE_NAME` (`refresh_token`) and a pure `refreshCookieOptions(env)` returning `{ httpOnly: true, secure, sameSite, path: '/auth', maxAge }`. Requirements: **production → `secure: true, sameSite: 'none'`** (cross-origin); **non-production → `secure: false, sameSite: 'lax'`**; `httpOnly` always true; `path` always `/auth`. Keep it pure so it is unit-testable without booting Nest. Use a string-literal union, not a TS `enum` (Constitution VI).
- [X] T006 Wire `apps/api/src/main.ts`: register `cookieParser()`, then `app.enableCors({ origin: <parsed CORS_ORIGINS array>, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET','POST','PATCH','DELETE','OPTIONS'] })`. **Must not use `*`** — browsers reject a wildcard with credentials. Read values from `ConfigService`, not `process.env` directly, so validation applies.
- [X] T007 Update `apps/api/src/auth/dto.ts` so `RefreshTokenRequestDto.refreshToken` is **optional** (the cookie may supply it). Keep validation on the type of a present value. Also relax the shared `RefreshTokenRequestDto.refreshToken` in `packages/types` to `refreshToken?: string` — it is the contract both sides compile against.
- [X] T008 Update `apps/api/src/auth/auth.controller.ts`:
  - `login` → add `@Res({ passthrough: true })` and `res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(env))`. Return the payload unchanged so the `ResponseInterceptor` still wraps it.
  - `refresh` → accept an **optional** body and read `req.cookies?.[REFRESH_COOKIE_NAME] ?? dto.refreshToken`. Resolve cookie first, body second. If neither is present, throw `UnauthorizedException`. **Do not change `AuthService`** — no rotation.
  - `logout` → add `@Res({ passthrough: true })` and `res.clearCookie(REFRESH_COOKIE_NAME, { path: '/auth' })`. The `path` must match the set path or the browser keeps the cookie.
- [X] T009 Add `CORS_ORIGINS` / `REFRESH_COOKIE_*` documentation to `apps/api/.env.example` with the production-vs-local values spelled out.

**Checkpoint**: `pnpm --filter @alfahd/api typecheck` passes. A manual `curl -i -X POST /auth/login` shows `Set-Cookie`; a `curl` to `/auth/refresh` with that cookie and an empty body `{}` returns 200.

---

## Phase 3: Backend e2e coverage *(spec R11 — backs the "tested" assumption)*

**Goal**: Replace an unevidenced assumption with real coverage of the endpoints this feature depends on.
**Independent Test**: `pnpm --filter @alfahd/api test:e2e` passes with auth, users CRUD, and guard behaviour asserted.

- [X] T012 Add `apps/api/src/config/refresh-cookie.spec.ts` (unit, not e2e — the cookie policy is pure and testable without booting Nest): assert `refreshCookieOptions` returns `sameSite: 'none'` + `secure: true` in production and `sameSite: 'lax'` + `secure: false` otherwise, that `httpOnly` is always true, that `path` is always `/auth`, that `maxAge` tracks `JWT_REFRESH_EXPIRES_IN`, that `SameSite=none` without `Secure` throws, and that `corsOrigins` never returns `*`.
- [X] T010 [P] Add `apps/api/test/auth.e2e-spec.ts`, following the existing `test/app.e2e-spec.ts` pattern (override `REDIS_CLIENT` with a stub so no live docker is required). Also register `cookieParser()` in the test app — `main.ts` does this at bootstrap, which the test harness bypasses. Assert: login success (200 + `Set-Cookie` present + `HttpOnly` set), login bad password (401, **no** cookie set), login rate limit (429), refresh **cookie-only** (200 + new `accessToken`, and assert the response body has **no** `refreshToken` field), refresh body-only fallback (200), refresh with neither (401), logout clears the cookie (`Max-Age=0`), deactivated user refresh (401).
- [X] T011 [P] Add `apps/api/test/users.e2e-spec.ts`: `GET /users` as ADMIN (200, array wrapped in `data`, `role` is `CS` for a CS user), as non-admin (403), without a token (401), `POST /users` duplicate email (409), `PATCH /users/:id` self-deactivation (400), `POST /users/change-password` wrong old password (400).

- [X] T013 Add CORS assertions to the auth e2e spec: a request carrying an `Origin` **not** in the allowlist gets no `Access-Control-Allow-Origin` header, and a preflight from an allowed origin returns `Access-Control-Allow-Credentials: true`. This is the guard against a future `*` regression, which would break cookie auth in production while every functional test still passed. Requires calling `app.enableCors(...)` in the test harness too, since `main.ts` is not exercised there.

**Checkpoint**: `pnpm --filter @alfahd/api test:e2e` green. Tests must not require live docker services beyond what the existing suite already assumes.

---

## Phase 4: Frontend foundation — API layer *(blocks all pages)*

**Goal**: Types and transport match the real backend.
**Independent Test**: `tsc --noEmit` passes in `apps/web`; a logged-in request carries `Authorization` and sends credentials.

- [ ] T014 [P] Update `apps/web/src/core/api/types.ts` to match the backend exactly, deleting invented fields:
  - `ApiResponse<T> = { data: T }` — **remove `success`** (it is not sent; the current type declares it required, so it is always `undefined` at runtime while typed as `boolean`)
  - `AuthUser = { id: string; email: string; role: 'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'; isActive: boolean; createdAt: string }` — **remove `name`, `status`, `department`, `warehouseId`**
  - Add `toFrontendRole(role)` producing the display label for `CS` → `"Customer Service"`, and `toBackendRole()` for the inverse. Display strings must never be sent to the backend.
  - `LoginResponse = { accessToken: string; refreshToken: string; user: AuthUser }` (login only)
  - Add `RefreshResponse = { accessToken: string }` — **no `refreshToken`**, matching the backend
  - Remove or clearly mark unused `PaginatedResponse` / `ListQueryParams`, or reduce them to what the users list actually uses
  - **Knock-on effect:** `PERMISSIONS` in `permissions.ts` is declared `as const satisfies Record<string, readonly Role[]>`, and six of its entries list `CUSTOMER_SERVICE`. Narrowing `Role` to `CS` makes the file **fail to compile** until those are replaced with `CS`. Do this in the same commit (see T028) — expect the typecheck error rather than being surprised by it.
- [ ] T015 [P] Update `apps/web/src/core/api/endpoints.ts`: users section uses `/users` paths; change-password points to `/users/change-password` (not `/auth/change-password`); no version prefix.
- [ ] T016 Rewrite `apps/web/src/core/api/axios-instance.ts`:
  - add `withCredentials: true` to `axios.create`
  - add the **missing request interceptor** attaching `Authorization: Bearer <accessToken>`, skipped for `/auth/login` and `/auth/refresh`. Without it no authenticated request carries a token and SC-002 cannot hold.
  - fix the refresh call to `POST /auth/refresh` with **credentials and no body token**, and store **only** `data.data.accessToken`. The current code reads `data.data.refreshToken` from a response that has no such field, writing `undefined` into the store and forcing a logout on the second 401 of any session.
  - keep single-flight dedup and the `_retry` once-guard; clear the in-flight promise in `finally`
  - on refresh failure: `clearSession()`, dispatch `SESSION_EXPIRED_EVENT`, reject

**Checkpoint**: `pnpm --filter fahd-dashboard typecheck` passes. No authenticated request is issued without a bearer header.

---

## Phase 5: Frontend auth — login + session (US1 + US2) — MVP

**Goal**: Real login replaces the mock. The refresh token never reaches JavaScript.
**Independent Test**: Log in with real credentials → lands on `/dashboard`. `localStorage` and `document.cookie` contain no token. Reload the page → still authenticated, no re-login.

- [ ] T017 [US2] Rewrite `apps/web/src/core/auth/auth.store.ts`: **remove the `persist` middleware entirely.** Hold `user` and `accessToken` in memory only. Remove the `fahd-session` JS-writable flag cookie (the proxy guard now reads the `httpOnly` cookie). `clearSession` resets state and broadcasts to other tabs.
- [ ] T018 [US2] Add `BroadcastChannel`-based cross-tab sync in `apps/web/src/core/auth/auth.store.ts`: on `clearSession()` publish a logout message; on receipt, other tabs clear their in-memory state and redirect to login. **Do not use the `storage` event** — with nothing written to `localStorage` it never fires. Guard for environments without `BroadcastChannel`.
- [ ] T019 [US2] Create `apps/web/src/components/auth/session-restore.tsx`: on mount, if no access token is in memory, call `POST /auth/refresh` **with credentials** once; on success populate the store; on 401 clear state and stay on login. **Must not retry in a loop** when no cookie is present. Render nothing while restoring to avoid a login-page flash.
- [ ] T020 [US1] Rewrite `apps/web/src/app/auth/login/page.tsx`: call `POST /auth/login` with email/password, unwrap `{ data: { accessToken, user } }`, store `user` + `accessToken` in memory, **discard the body's `refreshToken`** (never persist it — the cookie already holds it), redirect to `?redirect=` or `/dashboard`. Show "Invalid credentials" on 401, a rate-limit message on 429, and a generic message on 500/network.
- [ ] T021 [US1] Remove the fake-login leftovers: demo banner text, the `setTimeout` mock, and the Arabic "demo mode" badge.
- [ ] T022 [US1] Update `apps/web/src/components/auth/session-expiry-redirect.tsx` to listen for `SESSION_EXPIRED_EVENT`, call `clearSession()`, and redirect to `/auth/login?redirect=<current-path>`.

**Checkpoint**: Login works end-to-end. Reload preserves the session via cookie. No token in any JS-readable store. Logout clears everything and other tabs follow.

---

## Phase 6: Dashboard data (US3)

**Goal**: 3 real KPIs from `GET /users`, 1 placeholder.
**Independent Test**: Log in as ADMIN → dashboard shows real numbers for total/active/active-technicians, placeholder for tickets, skeletons while loading.

- [ ] T023 [US3] Rewrite `apps/web/src/app/(dashboard)/dashboard/page.tsx` as a client component: fetch `GET /users` via `api` (unwrap the `data` array), derive **total users** (length), **active users** (`isActive === true`), **active technicians** (`role === 'TECHNICIAN' && isActive === true`). Show skeletons while loading; on failure show an error state with a retry action and log it. Render the tickets KPI as a static placeholder with **no retry control** — a KPI with no endpoint must not offer a retry that cannot succeed.
- [ ] T024 [US3] Guard the dashboard page with the existing `RoleGuard` permission `dashboard.view`.

**Checkpoint**: Three real KPI values, one placeholder, distinct error vs placeholder states.

---

## Phase 7: Users list (US4)

**Goal**: The page at `/dashboard/employees` shows real users, labelled "Users".
**Independent Test**: Log in as ADMIN → table lists real users. Non-admin → access-denied.

- [ ] T025 [US4] Rewrite `apps/web/src/app/(dashboard)/employees/page.tsx`: fetch `GET /users` (unwrap the `data` array, no pagination), render email, role label via `toFrontendRole()`, active flag, and created date in the existing `DataTable`; delete the `MOCK_EMPLOYEES` array; show skeleton + error/retry states; show the count badge from real data. Update visible copy from "Employees" to "Users" (route path stays for bookmark stability).
- [ ] T026 [US4] Guard the page with `RoleGuard`, using the permission key that actually exists in `permissions.ts` — verify the name before wiring it rather than assuming `employees.manage` is present.

**Checkpoint**: No mock data anywhere. Table shows backend users.

---

## Phase 8: RBAC + polish (US5)

**Goal**: Routes protected, error handling consistent, gates green.
**Independent Test**: Logged-out user hitting `/dashboard` → redirected to login. Tampered token → 401 → login.

- [ ] T027 [US5] Update `apps/web/src/proxy.ts` to read the **`httpOnly` refresh cookie** for the auth check, keeping the `redirect` query parameter. The middleware cannot read an in-memory token, so this is the only place a server-side auth signal can come from.
- [ ] T028 [US5] Replace every `CUSTOMER_SERVICE` with `CS` across `apps/web/src`. `permissions.ts` has six such entries (`ips.view`, `customers.view`, `customers.manage`, `tickets.view`, `tickets.manage`, and the `Role` union it imports). Verify the mapping is display-only: the wire value is `CS`, and only `toFrontendRole()` produces human text.
- [ ] T029 [US5] Run the scenarios in `quickstart.md` and fix failures. Confirm SC-009 (no token in `localStorage`/`sessionStorage`/`document.cookie`) and SC-010 (reload restores; cleared cookie lands on login with no refresh loop). Note `quickstart.md` was written for the superseded body-based design — update its cookie/session steps to match Revision (2) before running it, or its assertions will test behaviour that no longer exists.
- [ ] T030 Run the full gate: `pnpm --filter @alfahd/types build`, then `pnpm --filter @alfahd/api typecheck`, `lint`, `test`, `test:e2e`, then `pnpm --filter fahd-dashboard typecheck`. All green before commit.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3, 4 → Phase 5 → Phases 6, 7 → Phase 8
- **Phase 2 strictly precedes Phase 5**: the frontend cannot use a cookie the backend never sets.
- T003, T004 parallel. T010, T011, T012 parallel (separate files).
- T014, T015 parallel. T016 after T014 (needs the new types).
- T017 before T018, T019, T022 (store shape first).
- T019 before T020 verification (restore must not fight the login page).
- T023/T024 independent of T025/T026; both need T016.
- T030 last.

## Parallel Example

```bash
# After Phase 2:
# Dev A: T010 + T011 + T012 + T013   (backend e2e)
# Dev B: T014 + T015 + T016          (API layer)
# Then:
# Dev A: T017 → T018 → T019 → T020 → T021 → T022   (auth)
# Dev B: T023 + T024                                (dashboard)
# Dev C: T025 + T026                                (users)
```

## MVP Scope

Ship Phases 1 + 2 + 3 + 4 + 5: real login, cookie-backed session, and the e2e coverage that justifies trusting it. The dashboard and users pages follow.

## Notes

- Commit after each task; use conventional commits with a useful what/why.
- **No schema migration** — this feature touches no table, so no Drizzle migration is needed.
- Do not add new endpoints. Do change `apps/api` auth transport and CORS, per spec Revision (2).
- Do not add React Query/SWR — keep the existing Axios pattern.
- `SameSite=Strict` MUST NOT be used for the refresh cookie; it is incompatible with the cross-origin deployment.
- Never read or write the refresh token in JavaScript; clearing it is the backend's job via `POST /auth/logout`.
- Rotation is still backend-owned and deferred (FR-004). Do not implement or assume it.
- Stop at each checkpoint to validate the story independently.