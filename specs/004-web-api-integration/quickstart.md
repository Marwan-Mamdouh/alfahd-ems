# Quickstart: Web API Integration

**Date**: 2026-10-01
**Feature**: Web API Integration (004)

## Prerequisites

- Node.js >= 22.12
- pnpm >= 11.26
- Docker (for local PostgreSQL + Redis)
- Backend API running on `http://localhost:3000`

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared types (required before anything else)
pnpm --filter @alfahd/types build

# 3. Start local infrastructure (PostgreSQL + Redis)
pnpm infra:up

# 4. Start the backend API (in one terminal)
pnpm api:dev

# 5. Start the frontend (in another terminal)
pnpm dev:web
```

## Environment Variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Validation Scenarios

### Scenario 1: Login with Real Credentials

**Steps**:
1. Navigate to `http://localhost:3000/auth/login`
2. Enter valid admin credentials
3. Submit the form

**Expected**:
- API call to `POST /auth/login` succeeds
- Access token held in memory (Zustand, no persist)
- Refresh token set as an `httpOnly` cookie — **not readable by JavaScript**
- User redirected to `/dashboard`
- Dashboard shows three real KPIs from `GET /users`

**Verify**:
```bash
# Check the API response in browser DevTools Network tab
# Should see POST /auth/login → 200 with { data: { accessToken, refreshToken, user } }
# user = { id, email, role, isActive, createdAt } — no name/department fields
# Should see 429 "Too many login attempts" after 5 attempts in 10 minutes from one IP

# Confirm the cookie is httpOnly and scoped to /auth:
# DevTools → Application → Cookies → http://localhost:3000 → refresh_token
#   httpOnly: true, path: /auth, sameSite: Lax (local) or None (production)

# Confirm JavaScript cannot see it:
#   localStorage.getItem('refreshToken')   → null
#   document.cookie                        → must NOT contain refresh_token
```

---

### Scenario 2: Token Refresh on Expiry

**Steps**:
1. Log in successfully
2. Wait 15 minutes (or modify token expiry for testing)
3. Make any API call (e.g., navigate to the users page)

**Expected**:
- Axios interceptor detects 401
- Automatically calls `POST /auth/refresh` **with credentials and no body token**
- Original request is retried once with the new access token
- User sees no interruption

**Verify**:
```bash
# In DevTools Network tab:
# 1. Original request → 401
# 2. POST /auth/refresh → 200, request body empty or {}, cookie sent
# 3. Original request retried → 200
# Refresh response contains ONLY { data: { accessToken } } — no refreshToken field
```

---

### Scenario 3: Session Expiry Redirect

**Steps**:
1. Log in successfully
2. Delete the `refresh_token` cookie in DevTools (or wait 7 days)
3. Make an API call

**Expected**:
- Refresh fails with 401
- Session is cleared
- User is redirected to `/auth/login?redirect=/dashboard`
- **No refresh retry loop** — exactly one `/auth/refresh` attempt, not repeated

---

### Scenario 3b: Session Survives Page Reload

**Steps**:
1. Log in successfully
2. Reload the page (F5), or close and reopen the browser tab
3. Navigate to `/dashboard`

**Expected**:
- On mount, the app calls `POST /auth/refresh` with credentials
- Session is restored **without** a re-login prompt — the access token is in memory only, so the cookie is the sole way to recover it
- No login-page flash while restoring

**This is the scenario that fails if the refresh cookie is not working.** If a reload drops you at login, check in order: cookie `Secure`/`SameSite` vs the page protocol, `withCredentials` on the axios instance, and the backend CORS allowlist.

---

### Scenario 3c: Cross-Tab Session Invalidation

**Steps**:
1. Log in, open the dashboard in two tabs
2. Log out in tab 1

**Expected**:
- Tab 2 receives the `BroadcastChannel` message, clears its state, and redirects to login within ~5 seconds
- Tab 2 makes **no** further authenticated API calls

---

### Scenario 4: Dashboard KPI Data

**Steps**:
1. Log in as admin
2. Navigate to `/dashboard`

**Expected**:
- **Three** real KPIs from `GET /users` (`{ data: [...] }` full array): total users (length), active users (`isActive === true`), active technicians (`role === "TECHNICIAN" && isActive === true`)
- The **tickets** KPI shows the "—" placeholder and offers **no retry control**
- Loading skeleton shown while data fetches
- If `GET /users` fails, all three real KPI cards show an error state **with** a retry action — visibly different from the tickets placeholder

---

### Scenario 5: Users List

**Steps**:
1. Log in as admin
2. Navigate to `/dashboard/employees`

**Expected**:
- Page is labelled **"Users"** (the route path is unchanged)
- Table shows real user data from `GET /users` (email, role label, active flag, created date)
- Role is displayed as "Customer Service" for backend value `CS` — never the raw `CS`
- Loading skeleton shown while fetching
- Sorting/filtering is client-side (no server pagination)
- No mock/hardcoded rows remain

---

### Scenario 6: RBAC Enforcement

**Steps**:
1. Log in as non-admin user (e.g., TECHNICIAN)
2. Navigate to `/dashboard/employees`

**Expected**:
- Access-denied message shown
- No API call to `GET /users` is made (or returns 403)
- Note this is a client-side usability guard only — the backend's ADMIN check is the real enforcement

---

### Scenario 7: Logout

**Steps**:
1. Log in successfully
2. Click logout (or session expires)

**Expected**:
- `POST /auth/logout` is called
- Session is cleared in memory and the `refresh_token` cookie is cleared by the backend
- User is redirected to login page
- Other open tabs are redirected via `BroadcastChannel`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `NEXT_PUBLIC_API_URL` not set | Create `apps/web/.env.local` with the variable |
| Backend not running | Run `pnpm api:dev` in a separate terminal |
| Docker not running | Run `pnpm infra:up` |
| Types not built | Run `pnpm --filter @alfahd/types build` |
| CORS errors | Check `CORS_ORIGINS` includes `http://localhost:3000`. It must be an explicit origin, never `*` — browsers reject a wildcard with credentials |
| **Refresh always 401s after a reload** | The cookie is not being sent. Check in order: (1) the cookie's `Secure` flag vs your page protocol — `SameSite=None` is **rejected without `Secure`**, so local HTTP needs `SameSite=Lax`; (2) `withCredentials: true` on the axios instance; (3) the backend reading the cookie — `POST /auth/refresh` with an empty body `{}` and the cookie should return 200 |
| **Logout doesn't clear the cookie** | The `path` on `clearCookie` must match the path used when setting it (`/auth`), or the browser keeps it |
| **Reload drops you at login** | See Scenario 3b — the session-restore call either is not firing or is failing |
| **Cross-tab sync never fires** | A `storage`-event listener will never fire, because no token is written to `localStorage`. Use `BroadcastChannel` |
| **Role shows raw `CS`** | Display labels come from `toFrontendRole()`; the wire value is `CS` and must not be rendered directly |
| `pnpm --filter @alfahd/api test:e2e` fails on connect | The `pg` pool connects lazily — unit tests need no docker, but e2e may. Run `pnpm infra:up` |
