# Feature Specification: Web API Integration

**Feature Branch**: `[004-web-api-integration]`

**Created**: 2026-10-01

**Status**: Amended 2026-10-01 (clarification session applied: R12 rewrite, retry policy, login non-enumeration, empty states, password recovery in scope)

**Input**: User description: "Inspect the front end and see what pages we have, and what end points we have to make the integration step for the auth and the pages we already have in the front. Build the specs on best practices and security first approach."

## Clarifications

### Session 2026-10-01
- Q: How should the refresh token httpOnly cookie be set? → A: ~~Backend sets `Set-Cookie` header with `httpOnly; Secure; SameSite=Strict` — frontend never touches the refresh token.~~ **SUPERSEDED by Revision (2) R1/R3** — the cookie is correct in principle, but `SameSite=Strict` is wrong: it is incompatible with the cross-origin Vercel↔Railway deployment. Use `SameSite=None; Secure` in production, `SameSite=Lax` on local HTTP.
- Q (2026-09-30 revision): Cookie transport requires a backend change, conflicting with frontend-only scope → A: ~~REVISED — keep body-based refresh for this feature; cookie storage deferred to a follow-up backend task.~~ **SUPERSEDED by Revision (2) R1/R2** — the deferral is reversed; this feature now carries the backend cookie work, with body transport retained as the mobile fallback.
- Q: Are new backend endpoints required as part of this feature's scope? → A: ~~No — this feature is frontend integration only.~~ **SUPERSEDED by Revision (2) R1/R4** — no new *endpoints* are added, but `login`/`refresh`/`logout` gain cookie handling and the app enables CORS. The backend surface stays `/auth/*` and `/users`.
- Q: Should the frontend call `GET /employees` or `GET /users`? → A: Frontend changes to call `GET /users` — aligns with existing backend contract. *(See also R9: the page is relabelled "Users" to match.)*
- Q: Should the API endpoints be versioned with a prefix like `/api/v1/`? → A: No versioning — use unversioned paths (`/auth/login`, `/users`).
- Q: The proxy guard is required to read the `httpOnly` refresh cookie, but that cookie is set by the API origin with `Path=/auth`, so Next.js middleware on the web origin can never see it. How should route protection actually work? → A: Add Next.js `rewrites` proxying `/api/:path*` to the API, so browser-facing calls stay same-origin and the refresh cookie is same-origin too — middleware can read it, and the JS-writable flag cookie becomes unnecessary. (FR-008)
- Q: Should failed API calls retry automatically before showing an error, and if so how many times? → A: Auto-retry idempotent GETs only — 2 attempts, exponential backoff (≈300ms, ≈900ms) — then show the error state. No auto-retry on POST/PATCH/DELETE, because retrying a mutation after a network error risks duplicate writes. The manual retry button is always present as the fallback. (FR-011)
- Q: Should login reveal that an email does not exist, or stay identical to a wrong-password error? → A: One generic "Invalid credentials" message for both cases, so login cannot be used to enumerate staff accounts. This matches `forgot-password`, which already always returns success. (CHK003)
- Q: When there are zero users, what should the Users page and the dashboard KPI cards show? → A: The Users table shows the existing `EmptyState` component; the three real KPI cards show the `—` placeholder, the same visual used for KPIs with no data source. Accepted tradeoff: "no data" stays visually consistent across the dashboard at the cost of conflating "no data source" with "zero records" on the real KPI cards. (CHK017)
- Q: Should the existing `forgot-password` and `reset-password` pages be wired to the real endpoints, or left mocked? → A: Wire both to the real endpoints. The backend already implements them, both pages already exist and are already registered as public routes, and the `TODO: Phase 2` placeholder means a reachable page currently claims an email was sent while doing nothing. (CHK001)

### Revision 2026-10-01 — Backend Reconciliation
The original spec was written against the 001-era backend. It has been reconciled with the current backend (`apps/api/src`, `@alfahd/types` DTOs, Redis session service, guards). Source-of-truth changes: response envelope is `{ data }` (no `success` flag); `UserDto` is `{ id, email, role, isActive, createdAt }` (no name/department fields); role value is `CS` (not `CUSTOMER_SERVICE`); `GET /users` returns the full array (no pagination); change-password lives at `POST /users/change-password` with `{oldPassword, newPassword}`; refresh returns `{accessToken}` only (no rotation); deactivation takes effect at next login/refresh, not on in-flight access tokens.

### Revision 2026-10-01 (2) — Requirements-Quality Review Resolutions
A requirements-quality review (`checklists/api.md`, `checklists/security.md`) found conflicts between the spec, its contracts, and the actual backend. This revision supersedes the earlier body-based-refresh decision and the frontend-only scope.

| # | Resolution | Supersedes |
|---|------------|------------|
| R1 | **Refresh token moves to an `httpOnly` cookie.** The backend sets it on login, reads it on refresh, clears it on logout. The frontend never holds the refresh token. This expands scope to a small, explicitly-bounded backend change. | Clarification 2026-10-01 (2nd bullet), FR-002's "out of scope" sentence |
| R2 | **Dual transport on refresh.** `POST /auth/refresh` prefers the cookie and falls back to the request body. Body transport is retained because the mobile app commits to `expo-secure-store` and bearer tokens (Constitution §V). | n/a — additive |
| R3 | **Cookie attributes are environment-driven.** `HttpOnly; Secure; SameSite=Lax; Path=/` in production; `HttpOnly; SameSite=Lax; Path=/` with `Secure` omitted on local HTTP (`SameSite=None` requires `Secure`, which requires HTTPS, so a single hard-coded policy silently breaks cookie auth on `http://localhost`). | Assumption "SameSite=None; Secure" — now applied conditionally rather than universally. **Path and SameSite amended by R12:** `Path=/` is required for the cookie to reach both `/api/auth/*` and the middleware-guarded page routes, and `SameSite=None` is no longer required for the web path once the rewrite makes it same-site (retained only for the mobile native client). |
| R4 | **CORS is enabled on the backend** with an explicit origin allowlist and `credentials: true`. Credentialed cookies require a specific `Access-Control-Allow-Origin`; `*` is invalid with credentials. `main.ts` had no `enableCors()` at all. | PLAN.md §6.5 assumed this existed |
| R5 | **Silent session restore on app boot.** With the access token in memory only, a page reload holds no token. The frontend MUST call `POST /auth/refresh` on mount to bootstrap a session from the cookie. | new |
| R6 | **Cross-tab sync uses `BroadcastChannel`,** not the `storage` event. With no tokens in `localStorage`, no `storage` write occurs and the event never fires. | FR-014's implied mechanism |
| R7 | **Dashboard shows 3 real KPIs + 1 placeholder.** `GET /users` yields exactly three metrics (total users, active users, active technicians). Ticket and inventory KPIs have no data source. | US3's "all four cards display real numbers" |
| R8 | **"No data source" and "fetch failed" are distinct states.** A KPI with no endpoint shows a static placeholder and offers **no** retry control; only a failed fetch offers retry. | SC-004's conflation of the two |
| R9 | **The page is relabelled "Users."** `GET /users` returns `UserDto`, which has no employee fields. Real employee data (department, national_id, hire_date) arrives in M2 #14/#15. | "Employees" naming throughout |
| R10 | **No server pagination.** Sorting and filtering are client-side over the full array. | SC-005's "paginated data", Assumption's "server-side pagination" |
| R11 | **Backend e2e coverage is added** for auth, users CRUD, and the RBAC guards, so the "fully functional and tested" assumption rests on evidence. | unevidenced assumption |
| R12 | **Web calls go through a Next.js `/api/*` rewrite.** The browser talks only to the Vercel origin; Railway is reached server-side. This is what makes FR-008 implementable — the refresh cookie is same-origin and therefore readable by middleware — and it removes the cross-site constraint that forced `SameSite=None`. It also forces the cookie `Path` to `/`, since RFC 6265 prefix matching means neither `/auth` nor `/api/auth` reaches both the refresh route and the middleware-guarded page routes. | FR-008's original "read the httpOnly cookie" wording; R3's "cross-site ⇒ `SameSite=None`" premise and its `Path=/auth` |

## Current State Assessment

### Frontend Pages (Built)
| Page | Route | Current State |
|------|-------|---------------|
| Login | `/auth/login` | Fake/mock authentication (hardcoded tokens, setTimeout) |
| Forgot password | `/forgot-password` | Mock — `TODO: Phase 2`, submit handler sets local state only; reachable via `proxy.ts` public routes and falsely confirms an email was sent |
| Reset password | `/forgot-password/reset-password` | Mock — `TODO: Phase 2`, no token handling |
| Dashboard | `/dashboard` | Static placeholder — KPI cards show "—" (no real data) |
| Users (was "Employees") | `/employees` (`(dashboard)` is a route group and adds no URL segment) | Mock data (hardcoded array of 4 users) |

### Frontend Auth Infrastructure (Built)
- **Auth Store** (Zustand + persist): Stores `accessToken`, `refreshToken`, `user` in `localStorage` — **a known XSS exposure that this feature removes**
- **Axios Instance**: Refresh-token interceptor with single-flight deduplication. **Two defects, both fixed by this feature:** (a) it reads `data.data.refreshToken` from the refresh response, which the backend does not return, so it overwrites the stored refresh token with `undefined` and forces a logout on the second 401; (b) there is **no request interceptor** at all, so no request carries `Authorization: Bearer` except the 401-retry path — SC-002 is therefore false today.
- **Route Guard** (`proxy.ts`): Checks for the JS-writable `fahd-session` cookie, which `auth.store.ts` writes via `document.cookie` with `samesite=strict`. This feature removes that flag cookie entirely; the guard reads the same-origin `httpOnly` refresh cookie instead, enabled by the `/api/*` rewrite (R12).
- **Base URL**: `axios-instance.ts` uses `process.env.NEXT_PUBLIC_API_URL` directly as `baseURL`, with an absolute URL hard-coded for the refresh call. With the rewrite, both become relative `/api` paths (FR-008).
- **Role Guard** (`RoleGuard`): Client-side permission checking via `hasPermission()`
- **Permissions Map**: 17 permissions across 4 roles (ADMIN, WAREHOUSE_STAFF, CS, TECHNICIAN). Note the frontend's `Role` type wrongly declares `CUSTOMER_SERVICE`; the backend value is `CS`.
- **Auth Events**: `SESSION_EXPIRED_EVENT` for global session expiry handling

### Backend Endpoints (Reconciled 2026-10-01 with `apps/api/src`; cookie behaviour added by Revision (2))
| Controller | Endpoints |
|------------|-----------|
| **Auth** (`/auth`) | `POST /login` (rate-limited 5/10min/IP → 429; **sets refresh cookie**), `POST /refresh` (**cookie preferred, body fallback** → `{accessToken}` only), `POST /logout` (JWT required; **clears refresh cookie**), `POST /forgot-password` (always `ok`), `POST /reset-password` (single-use 1h token) |
| **Users** (`/users`, JWT + ADMIN except change-password) | `POST /` (email/password min 8/role → 201, 409 on duplicate), `GET /` (full array, no pagination), `GET /:id`, `PATCH /:id` (email/role/isActive; `isActive:false` deactivates; self-deactivation → 400), `POST /change-password` (own password, `{oldPassword, newPassword}`), `POST /:id/revoke-session` → `{ok, revoked}` |

Global wire format: success → `{ data: <payload> }` (no `success` flag) — the `ResponseInterceptor` wraps **every** response, including `{ok: true}` endpoints; errors → `{ statusCode, message, path, timestamp }`. No global route prefix (no versioning). CORS is enabled with an explicit allowlist and `credentials: true` (added by this feature).

### Gap Analysis
The frontend `endpoints.ts` defines **60+ endpoints** across 12 domains (employees, attendance, warehouses, inventory, routers, ips, technicians, tracking, customers, tickets, reports, settings). The backend currently implements only **auth** and **users**. The three built frontend pages require:

1. **Login page** → needs real `POST /auth/login` integration
2. **Dashboard page** → needs real data (only `GET /users` is available; other KPIs will show placeholders)
3. **Employees page** → needs real `GET /users` endpoint (currently uses mock data)

**Scope Decision**: No new *endpoints* are created — the frontend uses the existing `/auth/*` and `/users` surface. However, this feature is **no longer frontend-only** (Revision (2) R1/R4): it carries a bounded backend change to support an `httpOnly` refresh cookie and credentialed CORS. The backend surface is otherwise unchanged. The frontend shows placeholder values for KPIs that require non-existent endpoints.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real Authentication Integration (Priority: P1)

As a system user, I need the login page to authenticate against the real backend API so that my credentials are verified and I receive valid session tokens.

**Why this priority**: The current login is a fake mock — no real authentication occurs. This is the highest security risk and must be resolved before any other integration.

**Independent Test**: Can be tested by entering valid credentials on the login page, verifying the API call succeeds, tokens are stored, and the user is redirected to the dashboard with a valid session.

**Acceptance Scenarios**:

1. **Given** the login page is loaded, **When** a user submits valid email and password, **Then** the system calls `POST /auth/login`, receives real access and refresh tokens, stores them securely, and redirects to the dashboard.
2. **Given** the login page is loaded, **When** a user submits invalid credentials, **Then** the system displays a clear error message ("Invalid credentials") and does not store any tokens. The message MUST be byte-identical whether the email is unknown or the password is wrong, and the frontend MUST NOT branch on the status code to produce a more specific message — an attacker must not be able to enumerate staff accounts through login.
3. **Given** a user is authenticated, **When** the access token expires, **Then** the axios interceptor automatically calls `POST /auth/refresh` with the refresh token and retries the original request transparently.
4. **Given** a user is authenticated, **When** the refresh token is invalid or expired, **Then** the system clears the session, dispatches a session-expired event, and redirects to the login page.
5. **Given** a user is on the login page, **When** they click logout (or session expires), **Then** `POST /auth/logout` is called to revoke the refresh token on the server.

---

### User Story 6 - Password Recovery Integration (Priority: P2)

As a user who has forgotten their password, I need the recovery pages to actually send a reset email so that I can regain access to my account.

**Why this priority**: Both pages exist, are routed as public, and currently display a fake confirmation — `forgot-password/page.tsx` has a `TODO: Phase 2` comment and a submit handler that only sets local state. A user who follows the flow is told an email was sent and nothing happens. This is a reachable dead end, so it is in scope.

**Independent Test**: Can be tested by submitting an unknown email (expect the same confirmation as a known one), then submitting a valid reset link's token and confirming the password changes and the old password stops working.

**Acceptance Scenarios**:

1. **Given** a user submits an email on the forgotten-password page, **When** the form is submitted, **Then** the system calls `POST /auth/forgot-password` and shows the confirmation "if the email is registered, a reset link has been sent" — identical text for registered and unregistered addresses.
2. **Given** a user follows a valid reset link, **When** they choose a new password, **Then** the system calls `POST /auth/reset-password` with the token and new password, and redirects to login on success.
3. **Given** a user follows an expired or already-used reset link, **When** they submit a new password, **Then** the page shows an explicit "this link is invalid or has expired" error and offers a route back to `forgot-password` — not a generic failure.
4. **Given** a user submits a new password the backend rejects, **When** validation fails, **Then** the page shows the server's reason. Client-side rules MUST NOT contradict the server (FR-025).

---

### User Story 2 - Secure Token Storage & Session Management (Priority: P1)

As a security-conscious administrator, I need tokens stored and managed securely so that session hijacking and token theft are minimized.

**Why this priority**: The current implementation stores tokens in `localStorage` which is vulnerable to XSS attacks. A security-first approach requires re-evaluating token storage.

**Independent Test**: Can be tested by verifying no token is reachable from JavaScript (`document.cookie` and `localStorage` contain neither), the refresh cookie survives a browser restart, and sessions are properly invalidated on logout.

**Acceptance Scenarios**:

1. **Given** a user logs in, **When** tokens are received, **Then** the access token is held in memory only (Zustand state, no persist middleware) and is NOT written to `localStorage`; the refresh token is set by the backend as an `httpOnly` cookie and is never exposed to JavaScript.
2. **Given** a user has an active session, **When** the page is reloaded or reopened, **Then** the frontend calls `POST /auth/refresh` on mount and the backend reads the `httpOnly` cookie, so the session is restored without a re-login prompt.
3. **Given** a user is signed in and a refresh occurs, **When** the backend issues a new access token, **Then** the same refresh token remains valid — this feature does **not** introduce rotation (see FR-004).
4. **Given** an admin revokes a user's session, **When** the user makes their next request, **Then** the refresh is rejected and their session is cleared within the access token's remaining lifetime (≤15 min), and immediately on any refresh attempt.

---

### User Story 3 - Dashboard Data Integration (Priority: P1)

As an administrator, I need the dashboard to display real key performance indicators so that I can monitor the system's operational health.

**Why this priority**: The dashboard is the landing page after login and currently shows only placeholder dashes. It must show real data to be useful.

**Independent Test**: Can be tested by logging in as an admin, navigating to the dashboard, and verifying that three KPI cards (total users, active users, active technicians) display real numbers derived from `GET /users`, while the tickets card displays the placeholder, and loading/error states appear as specified.

**Acceptance Scenarios**:

1. **Given** an admin is authenticated, **When** the dashboard loads, **Then** the system fetches `GET /users` (full array) and derives exactly three metrics — **total users** (array length), **active users** (`isActive === true`), **active technicians** (`role === 'TECHNICIAN' && isActive === true`). The **tickets** KPI has no data source and displays the placeholder with no retry control (R7/R8).
2. **Given** the dashboard is loading, **When** data is being fetched, **Then** loading skeletons are shown in place of each KPI card.
3. **Given** the `GET /users` fetch fails, **When** the dashboard renders, **Then** all three real KPI cards show an error state with a **retry** action, and the failure is logged. This is distinct from the tickets placeholder, which never offers retry.
4. **Given** a non-admin user (e.g., TECHNICIAN) accesses the dashboard, **When** they lack the `dashboard.view` permission, **Then** they see an access-denied message.

---

### User Story 4 - Users List Integration (Priority: P2)

As an administrator, I need the users page to display real user data from the backend so that I can manage staff accounts.

**Why this priority**: The page currently uses hardcoded mock data. It must be connected to the real API to be functional.

**Naming note (R9)**: The route stays `/employees` (`(dashboard)` is a route group and adds no URL segment) to avoid breaking bookmarks, but the page, table, and labels read **"Users"** because `GET /users` returns `UserDto` — which carries no employee fields. It becomes "Employees" when M2 #14/#15 lands the HR schema.

**Independent Test**: Can be tested by logging in as an admin, navigating to the users page, and verifying the table displays real user data fetched from the backend (full list, client-side sort/filter, no server pagination).

**Acceptance Scenarios**:

1. **Given** an admin is authenticated, **When** the users page loads, **Then** the system calls `GET /users` (returns the full array, no pagination) and displays each user (email, role label, active flag, created date) in the data table.
2. **Given** the users list is loading, **When** data is being fetched, **Then** a loading skeleton is shown in the table area. If the response is a successfully-fetched empty array, the table shows the `EmptyState` component ("no users") instead of an empty table shell.
3. **Given** the users list is loaded, **When** the user sorts or filters the table, **Then** it happens client-side (no server pages — the backend returns the full array).
4. **Given** a non-admin user accesses the users page, **When** they lack the permission to manage users, **Then** they see an access-denied message.

---

### User Story 5 - Route Protection & RBAC Enforcement (Priority: P1)

As a system administrator, I need all protected routes to enforce authentication and role-based access control so that unauthorized users cannot access restricted pages or data.

**Why this priority**: Security-first approach requires that every page and API call is protected. The current proxy guard only checks for a session cookie — it does not verify the token's validity or the user's role.

**Independent Test**: Can be tested by attempting to access protected routes without authentication, with invalid tokens, and with insufficient role permissions.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they attempt to access any protected route, **Then** they are redirected to the login page with a `redirect` query parameter.
2. **Given** an authenticated user with a valid token, **When** they access a route allowed for their role, **Then** the page renders normally.
3. **Given** an authenticated user, **When** they attempt to access a route restricted to a higher role, **Then** they see an access-denied message.
4. **Given** a user's token is invalid or tampered, **When** they make an API call, **Then** the backend returns 401 and the frontend redirects to login.

---

### Edge Cases

- What happens when the backend API is unreachable (network error, 503)? → The frontend should show a user-friendly error message with a retry option, not a blank page or uncaught exception.
- What happens when a user's session expires while they are filling out a form? → The form data should be preserved in local state, and after re-authentication, the user should be able to resubmit. No form in the current scope holds sensitive data; nothing may be written to `localStorage` as part of this preservation.
- What happens when two tabs are open and the user logs out in one tab? → The other tab detects it via `BroadcastChannel` and redirects to login. The `storage` event is unusable here because no token is written to `localStorage`, so no storage event ever fires.
- What happens when the refresh cookie is missing or expired but the access token is still in memory? → The frontend continues using the access token until it expires, then the failed refresh clears the session and redirects to login. It must not loop on refresh attempts.
- What happens when a user logs out and a stale refresh cookie is replayed? → Logout clears the cookie and revokes the Redis session; the replayed token fails the revocation check and returns 401.
- What happens when an admin deactivates a user who is currently logged in? → The deactivated user's current access token stays valid until it expires (up to 15 min; JWTs are stateless). Their next login and next `POST /auth/refresh` fail with 401.
- What happens when the proxy guard finds a refresh cookie but the session is actually revoked? → The refresh token is an opaque UUID backed by Redis (`rt:{userId}:{tokenId}`), so middleware can check **presence only** — it cannot validate the session without a network call on every request. A stale cookie therefore passes the guard and fails on the first real API call, which returns 401 and clears the session. The guard is a routing affordance; the API remains the only enforcement point (FR-009).
- What happens when the cookie exists in the browser but was scoped to a different environment's domain? → Localhost and production cookies are independent, so a session established on one is invisible to the other. Expected, not a bug.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The login page MUST authenticate users via `POST /auth/login` with email and password — no fake/mock authentication.
- **FR-002**: The access token MUST be held in memory only (Zustand state without persist middleware) and MUST NOT be written to `localStorage`, `sessionStorage`, or any JavaScript-readable cookie. The refresh token MUST be delivered to the browser only as an `httpOnly` cookie set by the backend and MUST NOT be exposed to JavaScript at any point.
- **FR-003**: The axios instance MUST attach `Authorization: Bearer <accessToken>` via a request interceptor on every request except `/auth/login`, and MUST automatically attempt a refresh and retry the original request once on a 401 response.
- **FR-004** (DEFERRED, backend-owned): Refresh token rotation is out of scope. `POST /auth/refresh` returns a new access token only; the same refresh token stays valid until logout or revocation. Rotation remains a follow-up backend task and MUST NOT be assumed by the frontend.
- **FR-005**: The system MUST clear all session state and redirect to login when the refresh token is invalid, expired, revoked, or absent.
- **FR-006**: The dashboard MUST derive exactly three real KPIs from `GET /users` — total users, active users, active technicians. KPIs with no backing endpoint (tickets) MUST display a static placeholder and MUST NOT offer a retry control. A failed fetch is a distinct state that MUST offer retry on the real KPI cards.
- **FR-007**: The users page MUST fetch and display real user data from `GET /users` (full array; client-side table only, no server pagination). Sorting and filtering MUST be client-side.
- **FR-008**: All protected routes MUST enforce authentication via the proxy guard — unauthenticated users are redirected to login with a `redirect` query parameter. The guard MUST read the refresh cookie. Because that cookie is set by the API origin, the web app MUST add a Next.js `rewrites` entry proxying `/api/:path*` to the API base URL so all browser-facing API calls are same-origin and the cookie is readable by middleware. The JavaScript-writable `fahd-session` flag cookie MUST be removed — a presence flag readable and writable by script is not an authentication control.
- **FR-009**: All protected pages MUST enforce role-based access control via the `RoleGuard` component. This is a **client-side usability affordance only** — it MUST NOT be treated as a security boundary. The backend's JWT guard and role checks remain the sole enforcement point.
- **FR-010**: The system MUST display loading states (skeletons) during data fetches.
- **FR-011**: The system MUST display user-friendly error messages when API calls fail, with a retry option for recoverable failures. Messages MUST be defined per failure mode: 401 → re-authentication; 403 → access denied; 429 → rate limited (honour `Retry-After`; the login endpoint allows **5 attempts per 10 minutes per IP**, so this state is reachable by ordinary use and MUST NOT be presented as a generic failure); 500 → generic server error; network → "connection lost".
- **FR-021**: The system MUST auto-retry idempotent `GET` requests only, at most 2 attempts with exponential backoff (≈300ms, then ≈900ms), before surfacing an error state. `POST`, `PATCH`, and `DELETE` MUST NOT be auto-retried — a mutation replayed after a network timeout can duplicate writes. 401 handling is governed by FR-003/FR-005 and is independent of this retry budget. A manual retry control MUST remain available on every error state regardless of whether auto-retry was attempted.
- **FR-022**: Login failure responses MUST be indistinguishable from the frontend's perspective — a single generic message for both unknown email and wrong password, with no branching on status code. The backend MUST also return the same 401 for both cases, so the protection does not depend on frontend behaviour alone. The login endpoint can return only **401, 429, and 5xx**; no other branch (including a future 404, 422, or 403) may reveal whether an account exists.
- **FR-023**: An empty-but-successful response MUST render an explicit empty state, never a blank container. `GET /users` returning `[]` shows the `EmptyState` component on the users page. On the dashboard, when the fetched array is empty, all three real KPI cards show the `—` placeholder — the same visual used for KPIs with no data source. This deliberately trades precision for visual consistency: the dashboard does not distinguish "no data source" from "zero records", and the Users page carries the precise empty-state signal instead.
- **FR-024**: The `forgot-password` and `reset-password` pages MUST call the real `POST /auth/forgot-password` and `POST /auth/reset-password` endpoints; their mock submit handlers and `TODO: Phase 2` comments MUST be removed. Both pages MUST be reachable routes — they currently live outside the App Router directory and return 404, while `proxy.ts` already whitelists both paths and the backend emails links to `/reset-password?token=…`. Both pages MUST show the same confirmation whether or not the email exists, matching the endpoint's always-success contract.
- **FR-025**: The reset-password page MUST accept a single-use token from the reset link, submit it together with the new password, and MUST NOT display a client-side password-strength rule that the backend does not enforce. Password rules shown to the user MUST match the server's validation, or the user is told a password is acceptable and is then rejected.
- **FR-026**: Failed data fetches MUST be logged for diagnosis, with the destination and content specified so the log cannot leak a credential: to the browser console via `console.error`, recording the **endpoint path and status code only**. A log MUST NOT include the access token, the refresh token, the refresh cookie value, a submitted password, or a full response body containing user email addresses. The web app has no error-reporting service in this feature, so console output is the only destination.
- **FR-027**: Page access MUST be gated by an explicit named permission rather than by role, so the requirement does not silently change when a role's permission set changes. The dashboard requires `dashboard.view`; the users list requires `employees.manage`. The authoritative role-to-permission matrix lives in `apps/web/src/core/permissions/permissions.ts` and MUST cover **all four roles** — `ADMIN`, `WAREHOUSE_STAFF`, `CS`, and `TECHNICIAN` — with `CS` (not `CUSTOMER_SERVICE`) as the customer-service value.
- **FR-028**: The post-login redirect target MUST be restricted to a **same-origin relative path beginning with a single `/`**. A `redirect` parameter holding an absolute URL, a protocol-relative URL (`//evil.example`), or a backslash-prefixed value MUST be discarded in favour of `/dashboard`, so a crafted login link cannot redirect a user to another origin after they authenticate.
- **FR-012**: The system MUST handle concurrent refresh requests using single-flight deduplication (at most one refresh call in flight; all concurrent 401s await the same promise and retry once each).
- **FR-013**: The system MUST preserve in-progress form data in React state when a session expires mid-interaction and allow resubmission after re-authentication. Nothing sensitive may be persisted to `localStorage`.
- **FR-014**: The system MUST detect cross-tab session expiry and redirect all tabs to login when the session is invalidated, using `BroadcastChannel`.
- **FR-015**: The backend verifies `isActive` at login and refresh — deactivated users receive 401 on next login/refresh; in-flight access tokens expire naturally (≤15 min).
- **FR-016**: The backend MUST set the refresh cookie on successful login, read it on refresh, and clear it on logout. On refresh the cookie is preferred; when absent, the request body is accepted as a fallback so the mobile app's bearer/`expo-secure-store` flow is unaffected. Because the browser-visible path is `/api/auth/*` after the rewrite (FR-008), the cookie's `Path` MUST be `/`, not `/auth` — RFC 6265 sends a cookie only on request paths it prefixes, so `Path=/auth` is never sent on `/api/auth/refresh` (breaking restore), and `Path=/api/auth` is never sent on `/dashboard` (breaking the FR-008 guard). `Path=/` is the only value that satisfies both. The cost is that the cookie is also attached to page navigations on our own origin; this is acceptable because it is `httpOnly`, same-origin after the rewrite, and read only on `/api/auth/refresh`. The mobile client is unaffected — it reads the token from the body and its own transport is unchanged.
- **FR-017**: The backend MUST enable CORS with an explicit origin allowlist and `credentials: true`. A wildcard origin MUST NOT be used, since browsers reject it with credentialed requests. With the `/api/*` rewrite in place (FR-008) CORS is no longer exercised by the web dashboard, but it remains required for the mobile app and for direct API consumers.
- **FR-018**: The frontend MUST send `withCredentials: true` on all API requests. Under the `/api/*` rewrite this is a no-op for same-origin calls, but keeping it explicit means the axios instance still works if a call is ever pointed at the absolute API URL (e.g. mobile-parity debugging).
- **FR-019**: The application MUST attempt a session restore on mount by calling `POST /auth/refresh` with credentials, so a page reload does not force a re-login.
- **FR-020**: The frontend MUST NOT read or write the refresh token in JavaScript, and MUST clear the `httpOnly` cookie only indirectly, by calling `POST /auth/logout`.

### Key Entities

- **UserDto** (canonical, from `@alfahd/types`): `{ id, email, role, isActive, createdAt }`. No `name`, `department`, or `warehouseId` fields exist — the UI shows the email and derives display info client-side.
- **Role**: `'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'` (backend value is `CS`; the dashboard displays it as "Customer Service").
- **AccessToken**: Short-lived JWT containing `sub`, `email`, `role`, `jti` (default 15 min) — stored in memory, sent as `Authorization: Bearer` header.
- **RefreshToken**: Opaque UUID (not a JWT) backed by the Redis session `rt:{userId}:{tokenId}` (7-day TTL). Delivered to the web client as an `httpOnly` cookie and sent in the request body only by the mobile client; logout/revocation adds it to the denylist `rv:{tokenId}`.
- **RefreshCookie**: Server-set, `HttpOnly`, `Path=/` (R3 as amended by R12). `SameSite=Lax` for the same-origin web path; `SameSite=None; Secure` remains supported for the mobile native client. Never readable by JavaScript.
- **Session** (server-side): a record in Redis mapping `userId` to `tokenId` — created on login, revoked on logout or admin action. This is the authority on whether a refresh token is valid.
- **Terminology — "session" has three distinct referents**, and requirements use them deliberately:
  1. **In-memory auth state** — the access token plus user profile in the Zustand store. What "session restore" rebuilds after a reload. Volatile; lost on refresh.
  2. **Browser session** — the `httpOnly` refresh cookie. The *only* artefact that survives a reload, and therefore the only thing restore can bootstrap from.
  3. **Server session** — the Redis record above.

  A requirement that says the session is "cleared" means **all three**: store reset, cookie cleared via `POST /auth/logout`, Redis record revoked. Clearing only the store leaves the user appearing logged out while the cookie still restores a session on the next load.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can log in with real credentials and reach the dashboard in under 3 seconds, measured from form submit to dashboard render, including network round-trips.
- **SC-002**: 100% of authenticated API calls carry a valid access token — verifiable by asserting no request other than `/api/auth/login` and `/api/auth/refresh` is issued without an `Authorization: Bearer` header.
- **SC-003**: Token refresh is transparent to users — no manual re-login is required during an active session, **including across page reloads and browser restarts**, because the refresh cookie restores the session (FR-019).
- **SC-004**: The dashboard displays three real KPIs derived from `GET /users` with loading states, and the tickets KPI displays the specified placeholder **with no retry control**. A failed `GET /users` shows an error state with retry on all three real KPI cards.
- **SC-005**: The users page displays real data from `GET /users` with client-side sort and filter — no mock data remains, and no server pagination is used.
- **SC-006**: Unauthorized access attempts are blocked with appropriate error messages — no data leaks to unauthenticated users, and no protected request is issued without a bearer token.
- **SC-007**: Session expiry or logout propagates to all open tabs within 5 seconds of the originating tab acting, measurable by timestamping the broadcast and the redirect in each tab.
- **SC-008** (DEFERRED): Removed from this feature's acceptance. Tracked as a backend follow-up.
- **SC-009**: The refresh token is never present in `localStorage`, `sessionStorage`, or `document.cookie` after login — verifiable by inspecting each store and the cookie jar.
- **SC-010**: A page reload with a valid refresh cookie restores the session without a re-login prompt; with the cookie cleared, the app lands on login and makes no retry loop against `/api/auth/refresh`. The cookie must survive the rewrite intact — verified by confirming it is sent on both `/api/auth/refresh` and `/dashboard`.
- **SC-011**: A `GET` that fails with a transient 5xx or network error retries at most twice before the error state appears, and a `POST` that fails the same way issues exactly one network call — verified by counting requests in a mocked-interceptor test.
- **SC-012**: With `GET /users` returning `[]`, the dashboard renders the `—` placeholder on all three real KPI cards and the users page renders a visible "no users" empty state — verified in both a unit test and manually. No screen renders an empty table or `null` in place of content.
- **SC-013**: Submitting `forgot-password` with an unregistered email produces byte-identical confirmation text to a registered one, and no request to the API is left showing a distinguishable failure — verified by comparing rendered output for both inputs.
- **SC-014**: Resetting a password with a valid token succeeds and the previous password no longer logs in; a used or expired token shows an explicit expired-link message with a path back to `forgot-password`.

---

## Assumptions

- The backend auth endpoints (`/auth/login`, `/auth/refresh`, `/auth/logout`) are implemented (M1). **Their behavioural coverage is added by this feature (R11)** — the repository's only e2e spec (`test/app.e2e-spec.ts`) covers `AppController` alone, and no unit spec exercises `login`/`refresh` logic, the users controller, or the RBAC guards, so the earlier claim that these endpoints were "tested" was unevidenced.
- The backend users endpoints (`/users`, `/users/:id`) are implemented (M1), likewise covered by the e2e work added here.
- This feature adds **no new endpoints**. It does add cookie handling to `/auth/login`, `/auth/refresh`, `/auth/logout` and enables CORS, per Revision (2) R1/R4.
- The frontend will use the existing Axios instance; its refresh interceptor is corrected rather than replaced (see the two defects recorded under Current State Assessment).
- The `api` axios base URL becomes the relative `/api` prefix backed by the Next.js rewrite, not `NEXT_PUBLIC_API_URL` (R12). This is what keeps the refresh cookie same-origin and therefore readable by middleware.
- Client-side password-strength rules on the reset-password page must not be invented: the backend enforces password length (min 8 on user creation) and nothing more specific, so any client rule shown must be traceable to a server rule (FR-025).
- Cross-tab session expiry uses `BroadcastChannel` (R6), not the `storage` event, since no token is written to `localStorage`.
- The `RoleGuard` and `permissions.ts` components are reused as-is for the pages in scope.
- The `DataTable` component is reused for the users list in **client-side** mode; server-side pagination is not used because `GET /users` returns the full array.
- Form data preservation on session expiry uses React state only, never persisted storage.
- Reconciled 2026-10-01 with the current backend: response envelope `{ data }`, `UserDto` has no name/department fields, `GET /users` has no pagination, change-password lives at `POST /users/change-password` with `{oldPassword, newPassword}`.
- Password hashing is argon2id everywhere (per 003-argon2-enum-migration, verified in tree): `auth.service.ts` and `users.service.ts` both use `argon2` with `ARGON2_OPTIONS`; no bcrypt remains. No hashing caveat applies to this feature.
- `forgot-password` always returns success regardless of whether the email exists (FR-022 extends the same non-enumerating stance to login). Reset tokens are single-use and expire after 1 hour.
- Cookie attributes (R3, as amended by R12): the web cookie is `HttpOnly; SameSite=Lax; Path=/`, plus `Secure` in production. `SameSite=None` is no longer needed for the web path because the `/api/*` rewrite makes every call same-origin, but the backend must still be able to emit `SameSite=None` for the mobile native client, so the attribute stays environment-driven rather than hard-coded. Local development over plain HTTP omits `Secure` — `SameSite=None` is rejected without `Secure`, so a single hard-coded policy silently breaks cookie auth.
- The frontend and API deploy on different origins (Vercel and Railway), but the browser never talks to Railway directly: the `/api/*` rewrite (FR-008) makes every web call same-origin. The backend still echoes a specific allowed origin rather than `*` for the mobile app.
- Because web calls are same-origin through the rewrite, the refresh cookie's `SameSite` requirement drops: `SameSite=Lax` is sufficient in every environment, and `SameSite=None` is no longer forced by a cross-site web deployment. The backend must still support `SameSite=None` for the mobile app's native client.
- `Path=/` is required after R12 (RFC 6265 prefix matching): `/auth` never matches `/api/auth/*`, and `/api/auth` never matches `/dashboard`. The cookie is therefore also attached to page navigations on the dashboard's own origin — accepted, since it is `httpOnly`, same-site, and read only on `/api/auth/refresh`.
- The mobile app keeps body-based refresh. `POST /auth/refresh` accepts either transport, so the M5 work is unaffected by the cookie change.
