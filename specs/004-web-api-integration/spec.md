# Feature Specification: Web API Integration

**Feature Branch**: `[004-web-api-integration]`

**Created**: 2026-10-01

**Status**: Amended 2026-10-01 (requirements-quality review resolutions applied; see Revision (2))

**Input**: User description: "Inspect the front end and see what pages we have, and what end points we have to make the integration step for the auth and the pages we already have in the front. Build the specs on best practices and security first approach."

## Clarifications

### Session 2026-10-01
- Q: How should the refresh token httpOnly cookie be set? → A: ~~Backend sets `Set-Cookie` header with `httpOnly; Secure; SameSite=Strict` — frontend never touches the refresh token.~~ **SUPERSEDED by Revision (2) R1/R3** — the cookie is correct in principle, but `SameSite=Strict` is wrong: it is incompatible with the cross-origin Vercel↔Railway deployment. Use `SameSite=None; Secure` in production, `SameSite=Lax` on local HTTP.
- Q (2026-09-30 revision): Cookie transport requires a backend change, conflicting with frontend-only scope → A: ~~REVISED — keep body-based refresh for this feature; cookie storage deferred to a follow-up backend task.~~ **SUPERSEDED by Revision (2) R1/R2** — the deferral is reversed; this feature now carries the backend cookie work, with body transport retained as the mobile fallback.
- Q: Are new backend endpoints required as part of this feature's scope? → A: ~~No — this feature is frontend integration only.~~ **SUPERSEDED by Revision (2) R1/R4** — no new *endpoints* are added, but `login`/`refresh`/`logout` gain cookie handling and the app enables CORS. The backend surface stays `/auth/*` and `/users`.
- Q: Should the frontend call `GET /employees` or `GET /users`? → A: Frontend changes to call `GET /users` — aligns with existing backend contract. *(See also R9: the page is relabelled "Users" to match.)*
- Q: Should the API endpoints be versioned with a prefix like `/api/v1/`? → A: No versioning — use unversioned paths (`/auth/login`, `/users`).

### Revision 2026-10-01 — Backend Reconciliation
The original spec was written against the 001-era backend. It has been reconciled with the current backend (`apps/api/src`, `@alfahd/types` DTOs, Redis session service, guards). Source-of-truth changes: response envelope is `{ data }` (no `success` flag); `UserDto` is `{ id, email, role, isActive, createdAt }` (no name/department fields); role value is `CS` (not `CUSTOMER_SERVICE`); `GET /users` returns the full array (no pagination); change-password lives at `POST /users/change-password` with `{oldPassword, newPassword}`; refresh returns `{accessToken}` only (no rotation); deactivation takes effect at next login/refresh, not on in-flight access tokens.

### Revision 2026-10-01 (2) — Requirements-Quality Review Resolutions
A requirements-quality review (`checklists/api.md`, `checklists/security.md`) found conflicts between the spec, its contracts, and the actual backend. This revision supersedes the earlier body-based-refresh decision and the frontend-only scope.

| # | Resolution | Supersedes |
|---|------------|------------|
| R1 | **Refresh token moves to an `httpOnly` cookie.** The backend sets it on login, reads it on refresh, clears it on logout. The frontend never holds the refresh token. This expands scope to a small, explicitly-bounded backend change. | Clarification 2026-10-01 (2nd bullet), FR-002's "out of scope" sentence |
| R2 | **Dual transport on refresh.** `POST /auth/refresh` prefers the cookie and falls back to the request body. Body transport is retained because the mobile app commits to `expo-secure-store` and bearer tokens (Constitution §V). | n/a — additive |
| R3 | **Cookie attributes are environment-driven.** Production: `HttpOnly; Secure; SameSite=None; Path=/auth`. Local HTTP: `HttpOnly; SameSite=Lax; Path=/auth`, `Secure` omitted (`SameSite=None` requires `Secure`, which requires HTTPS, so a single hard-coded policy silently breaks cookie auth on `http://localhost`). `Path=/auth` keeps the refresh cookie off every `/users` request. | Assumption "SameSite=None; Secure" — now applied conditionally rather than universally |
| R4 | **CORS is enabled on the backend** with an explicit origin allowlist and `credentials: true`. Credentialed cookies require a specific `Access-Control-Allow-Origin`; `*` is invalid with credentials. `main.ts` had no `enableCors()` at all. | PLAN.md §6.5 assumed this existed |
| R5 | **Silent session restore on app boot.** With the access token in memory only, a page reload holds no token. The frontend MUST call `POST /auth/refresh` on mount to bootstrap a session from the cookie. | new |
| R6 | **Cross-tab sync uses `BroadcastChannel`,** not the `storage` event. With no tokens in `localStorage`, no `storage` write occurs and the event never fires. | FR-014's implied mechanism |
| R7 | **Dashboard shows 3 real KPIs + 1 placeholder.** `GET /users` yields exactly three metrics (total users, active users, active technicians). Ticket and inventory KPIs have no data source. | US3's "all four cards display real numbers" |
| R8 | **"No data source" and "fetch failed" are distinct states.** A KPI with no endpoint shows a static placeholder and offers **no** retry control; only a failed fetch offers retry. | SC-004's conflation of the two |
| R9 | **The page is relabelled "Users."** `GET /users` returns `UserDto`, which has no employee fields. Real employee data (department, national_id, hire_date) arrives in M2 #14/#15. | "Employees" naming throughout |
| R10 | **No server pagination.** Sorting and filtering are client-side over the full array. | SC-005's "paginated data", Assumption's "server-side pagination" |
| R11 | **Backend e2e coverage is added** for auth, users CRUD, and the RBAC guards, so the "fully functional and tested" assumption rests on evidence. | unevidenced assumption |

## Current State Assessment

### Frontend Pages (Built)
| Page | Route | Current State |
|------|-------|---------------|
| Login | `/auth/login` | Fake/mock authentication (hardcoded tokens, setTimeout) |
| Dashboard | `/dashboard` | Static placeholder — KPI cards show "—" (no real data) |
| Users (was "Employees") | `/dashboard/employees` | Mock data (hardcoded array of 4 users) |

### Frontend Auth Infrastructure (Built)
- **Auth Store** (Zustand + persist): Stores `accessToken`, `refreshToken`, `user` in `localStorage` — **a known XSS exposure that this feature removes**
- **Axios Instance**: Refresh-token interceptor with single-flight deduplication. **Two defects, both fixed by this feature:** (a) it reads `data.data.refreshToken` from the refresh response, which the backend does not return, so it overwrites the stored refresh token with `undefined` and forces a logout on the second 401; (b) there is **no request interceptor** at all, so no request carries `Authorization: Bearer` except the 401-retry path — SC-002 is therefore false today.
- **Route Guard** (`proxy.ts`): Checks for the JS-writable `fahd-session` cookie. Once the refresh cookie is `httpOnly`, the middleware reads that instead, so the flag cookie becomes unnecessary.
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
2. **Given** the login page is loaded, **When** a user submits invalid credentials, **Then** the system displays a clear error message ("Invalid credentials") and does not store any tokens.
3. **Given** a user is authenticated, **When** the access token expires, **Then** the axios interceptor automatically calls `POST /auth/refresh` with the refresh token and retries the original request transparently.
4. **Given** a user is authenticated, **When** the refresh token is invalid or expired, **Then** the system clears the session, dispatches a session-expired event, and redirects to the login page.
5. **Given** a user is on the login page, **When** they click logout (or session expires), **Then** `POST /auth/logout` is called to revoke the refresh token on the server.

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

**Naming note (R9)**: The route stays `/dashboard/employees` to avoid breaking bookmarks, but the page, table, and labels read **"Users"** because `GET /users` returns `UserDto` — which carries no employee fields. It becomes "Employees" when M2 #14/#15 lands the HR schema.

**Independent Test**: Can be tested by logging in as an admin, navigating to the users page, and verifying the table displays real user data fetched from the backend (full list, client-side sort/filter, no server pagination).

**Acceptance Scenarios**:

1. **Given** an admin is authenticated, **When** the users page loads, **Then** the system calls `GET /users` (returns the full array, no pagination) and displays each user (email, role label, active flag, created date) in the data table.
2. **Given** the users list is loading, **When** data is being fetched, **Then** a loading skeleton is shown in the table area.
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
- **FR-008**: All protected routes MUST enforce authentication via the proxy guard — unauthenticated users are redirected to login with a `redirect` query parameter. The guard MUST read the `httpOnly` refresh cookie rather than relying solely on a JavaScript-writable flag cookie.
- **FR-009**: All protected pages MUST enforce role-based access control via the `RoleGuard` component. This is a **client-side usability affordance only** — it MUST NOT be treated as a security boundary. The backend's JWT guard and role checks remain the sole enforcement point.
- **FR-010**: The system MUST display loading states (skeletons) during data fetches.
- **FR-011**: The system MUST display user-friendly error messages when API calls fail, with a retry option for recoverable failures. Messages MUST be defined per failure mode: 401 → re-authentication; 403 → access denied; 429 → rate limited (honour `Retry-After`); 500 → generic server error; network → "connection lost".
- **FR-012**: The system MUST handle concurrent refresh requests using single-flight deduplication (at most one refresh call in flight; all concurrent 401s await the same promise and retry once each).
- **FR-013**: The system MUST preserve in-progress form data in React state when a session expires mid-interaction and allow resubmission after re-authentication. Nothing sensitive may be persisted to `localStorage`.
- **FR-014**: The system MUST detect cross-tab session expiry and redirect all tabs to login when the session is invalidated, using `BroadcastChannel`.
- **FR-015**: The backend verifies `isActive` at login and refresh — deactivated users receive 401 on next login/refresh; in-flight access tokens expire naturally (≤15 min).
- **FR-016**: The backend MUST set the refresh cookie on successful login, read it on refresh, and clear it on logout. On refresh the cookie is preferred; when absent, the request body is accepted as a fallback so the mobile app's bearer/`expo-secure-store` flow is unaffected.
- **FR-017**: The backend MUST enable CORS with an explicit origin allowlist and `credentials: true`. A wildcard origin MUST NOT be used, since browsers reject it with credentialed requests.
- **FR-018**: The frontend MUST send credentials with cross-origin requests (`withCredentials: true`); without it the browser drops the cookie and refresh fails silently.
- **FR-019**: The application MUST attempt a session restore on mount by calling `POST /auth/refresh` with credentials, so a page reload does not force a re-login.
- **FR-020**: The frontend MUST NOT read or write the refresh token in JavaScript, and MUST clear the `httpOnly` cookie only indirectly, by calling `POST /auth/logout`.

### Key Entities

- **UserDto** (canonical, from `@alfahd/types`): `{ id, email, role, isActive, createdAt }`. No `name`, `department`, or `warehouseId` fields exist — the UI shows the email and derives display info client-side.
- **Role**: `'ADMIN' | 'WAREHOUSE_STAFF' | 'CS' | 'TECHNICIAN'` (backend value is `CS`; the dashboard displays it as "Customer Service").
- **AccessToken**: Short-lived JWT containing `sub`, `email`, `role`, `jti` (default 15 min) — stored in memory, sent as `Authorization: Bearer` header.
- **RefreshToken**: Opaque UUID (not a JWT) backed by the Redis session `rt:{userId}:{tokenId}` (7-day TTL). Delivered to the web client as an `httpOnly` cookie and sent in the request body only by the mobile client; logout/revocation adds it to the denylist `rv:{tokenId}`.
- **RefreshCookie**: Server-set, `HttpOnly`, `Path=/auth`. `SameSite=None; Secure` in production, `SameSite=Lax` without `Secure` on local HTTP (R3). Never readable by JavaScript.
- **Session**: A server-side record in Redis mapping `userId` to `tokenId` — created on login, revoked on logout or admin action.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can log in with real credentials and reach the dashboard in under 3 seconds, measured from form submit to dashboard render, including network round-trips.
- **SC-002**: 100% of authenticated API calls carry a valid access token — verifiable by asserting no request other than `/auth/login` and `/auth/refresh` is issued without an `Authorization: Bearer` header.
- **SC-003**: Token refresh is transparent to users — no manual re-login is required during an active session, **including across page reloads and browser restarts**, because the refresh cookie restores the session (FR-019).
- **SC-004**: The dashboard displays three real KPIs derived from `GET /users` with loading states, and the tickets KPI displays the specified placeholder **with no retry control**. A failed `GET /users` shows an error state with retry on all three real KPI cards.
- **SC-005**: The users page displays real data from `GET /users` with client-side sort and filter — no mock data remains, and no server pagination is used.
- **SC-006**: Unauthorized access attempts are blocked with appropriate error messages — no data leaks to unauthenticated users, and no protected request is issued without a bearer token.
- **SC-007**: Session expiry or logout propagates to all open tabs within 5 seconds of the originating tab acting, measurable by timestamping the broadcast and the redirect in each tab.
- **SC-008** (DEFERRED): Removed from this feature's acceptance. Tracked as a backend follow-up.
- **SC-009**: The refresh token is never present in `localStorage`, `sessionStorage`, or `document.cookie` after login — verifiable by inspecting each store and the cookie jar.
- **SC-010**: A page reload with a valid refresh cookie restores the session without a re-login prompt; with the cookie cleared, the app lands on login and makes no retry loop against `/auth/refresh`.

---

## Assumptions

- The backend auth endpoints (`/auth/login`, `/auth/refresh`, `/auth/logout`) are implemented (M1). **Their behavioural coverage is added by this feature (R11)** — the repository's only e2e spec (`test/app.e2e-spec.ts`) covers `AppController` alone, and no unit spec exercises `login`/`refresh` logic, the users controller, or the RBAC guards, so the earlier claim that these endpoints were "tested" was unevidenced.
- The backend users endpoints (`/users`, `/users/:id`) are implemented (M1), likewise covered by the e2e work added here.
- This feature adds **no new endpoints**. It does add cookie handling to `/auth/login`, `/auth/refresh`, `/auth/logout` and enables CORS, per Revision (2) R1/R4.
- The frontend will use the existing Axios instance; its refresh interceptor is corrected rather than replaced (see the two defects recorded under Current State Assessment).
- Cross-tab session expiry uses `BroadcastChannel` (R6), not the `storage` event, since no token is written to `localStorage`.
- The `RoleGuard` and `permissions.ts` components are reused as-is for the pages in scope.
- The `DataTable` component is reused for the users list in **client-side** mode; server-side pagination is not used because `GET /users` returns the full array.
- Form data preservation on session expiry uses React state only, never persisted storage.
- Reconciled 2026-10-01 with the current backend: response envelope `{ data }`, `UserDto` has no name/department fields, `GET /users` has no pagination, change-password lives at `POST /users/change-password` with `{oldPassword, newPassword}`.
- Password hashing is argon2id everywhere (per 003-argon2-enum-migration, verified in tree): `auth.service.ts` and `users.service.ts` both use `argon2` with `ARGON2_OPTIONS`; no bcrypt remains. No hashing caveat applies to this feature.
- Cookie attributes (R3): production uses `HttpOnly; Secure; SameSite=None; Path=/auth` because the Vercel↔Railway deployment is cross-site. Local development over plain HTTP uses `HttpOnly; SameSite=Lax; Path=/auth` with `Secure` omitted — `SameSite=None` is rejected without `Secure`, so a single hard-coded policy silently breaks local cookie auth. The switch is driven by an environment value, never by a hard-coded literal.
- The frontend and API are deployed on different origins, so every API call must be credentialed (`withCredentials`) and the backend must echo a specific allowed origin rather than `*`.
- The mobile app keeps body-based refresh. `POST /auth/refresh` accepts either transport, so the M5 work is unaffected by the cookie change.
