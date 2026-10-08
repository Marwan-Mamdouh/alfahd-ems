# Quickstart: Web API Integration

**Date**: 2026-10-02
**Feature**: Web API Integration (004)

## ⚠️ Read this before running anything

Two facts make this guide different from the previous version.

1. **`apps/web` has no test runner.** It ships only `typecheck` and `lint`. **These scenarios are the verification for all web work** — run them, do not assume correctness from a clean typecheck.
2. **The ports collide.** The API defaults to `3000` and Next.js also defaults to `3000`. The dashboard **must** run on `3001**. The previous version of this guide said to run both on `3000`, which cannot work.

> **`PORT` in `apps/web/.env.local` does NOT change the Next.js port, so `pnpm dev:web` now pins it explicitly.** `apps/web`'s `dev` and `start` scripts pass `--port 3001`, so the collision cannot recur through the normal scripts. Verified failure mode if the dashboard ever *does* land on 3000: Next.js takes the port, the API cannot start (or dies with `EADDRINUSE` while still logging "successfully started"), and `API_URL=http://localhost:3000` makes the rewrite fetch **the dashboard itself**. `/api/auth/login` then returns the app's own HTML with a **200**, the response fails to parse, and the UI reports a generic connection failure — even though nothing is wrong with the credentials. If you see that, check which process owns 3000.

## Prerequisites

- Node.js >= 22.12, pnpm 12.6.0
- Docker (local PostgreSQL + Redis)
- A browser with DevTools (you will inspect cookies repeatedly)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared types — REQUIRED before anything that imports @alfahd/types
pnpm --filter @alfahd/types build

# 3. Start PostgreSQL + Redis
pnpm infra:up

# 4. API on port 3000 (terminal 1)
pnpm api:dev

# 5. Dashboard on port 3001 (terminal 2) — the `dev` script already passes
#    `--port 3001`, so no extra flag is needed
pnpm dev:web
```

Confirm the dashboard is really on 3001 before continuing: the startup banner prints `Local: http://localhost:3001`.

## Environment

`apps/web/.env.local`:

```env
API_URL=http://localhost:3000
```

`API_URL` is **server-only** — it is the rewrite target read by `next.config.ts`. Do not use a `NEXT_PUBLIC_` prefix: those values are inlined into the browser bundle and would expose the internal host.

> `PORT=3001` may sit in `.env.local` for documentation, but it does **not** control the Next.js dev port — pass `--port 3001` instead.

`apps/api/.env` — for local HTTP, no cookie env vars are needed. They default from `NODE_ENV`:

```env
PORT=3000
FRONTEND_URL=http://localhost:3001      # must match the dashboard port
CORS_ORIGINS=http://localhost:3001      # required for mobile / direct clients
```

> `FRONTEND_URL` also builds the password-reset link the backend emails. If it still says `:3000`, reset emails point at the wrong port.

---

## Validation Scenarios

Browser URLs assume the dashboard is on **3001**; API paths in the Network tab appear as **`/api/...`** because of the rewrite.

### Scenario 1 — Login with real credentials

1. Go to `http://localhost:3001/auth/login`
2. Enter valid credentials, submit

**Expected**: `POST /api/auth/login` → 200, redirected to `/dashboard`, and the dashboard shows three real KPIs.

**Verify in DevTools** → Application → Cookies → `http://localhost:3001` → `refresh_token`:

```
httpOnly: true
path:     /            ← must be "/", not "/auth"
sameSite: Lax
secure:   false        ← false on local HTTP; true in production
```

**Verify in Console**:

```js
document.cookie                                    // must NOT contain refresh_token
localStorage.getItem('fahd-auth')                  // null
sessionStorage.getItem('fahd-auth')                // null
localStorage.length                                // 0
```

---

### Scenario 2 — Session survives a page reload

**This is the scenario that catches every cookie mistake.**

1. Log in, then press **F5**
2. Navigate to `/dashboard`

**Expected**: you stay on the dashboard. The Network tab shows exactly **one** `POST /api/auth/refresh` with an empty body.

**If you land on `/auth/login` instead**, the cookie is not being sent. Check, in order:

1. Cookie `Path` is `/` — a cookie scoped to `/auth` or `/api/auth` will not reach both `/api/auth/refresh` and `/dashboard`
2. `API_URL` is set and `next.config.ts` has the rewrite (a missing rewrite gives a Next.js 404, not a 401)
3. `withCredentials: true` on the axios instance

Then, with the `refresh_token` cookie **deleted**, reload:

**Expected**: you land on login, and there is **no retry loop** — exactly one refresh attempt in the Network tab.

---

### Scenario 3 — Transparent token refresh

1. Log in, wait for the access token to expire (15 min by default)
2. Trigger any API call, e.g. open `/employees`

**Expected**: original request → 401, then `POST /api/auth/refresh` → 200, then the original request retried → 200. The user sees no interruption.

The refresh response contains **only** `{ accessToken }` — no `refreshToken`, no rotation.

---

### Scenario 4 — Logout and cross-tab invalidation

1. Log in, open `/dashboard` in **two** tabs
2. Log out in tab 1

**Expected**:

- `POST /api/auth/logout` → 200; the cookie is cleared
- Tab 2 redirects to login **within ~5 seconds** via `BroadcastChannel`
- Tab 2 issues no further authenticated calls
- The cookie is gone from DevTools

> If cross-tab sync never fires, confirm you are **not** using a `storage`-event listener. With no token in `localStorage` no storage event is ever emitted, so a `storage` listener is inert.

> If logout appears not to work, the `clearCookie` path must **match** the path used when setting the cookie.

---

### Scenario 5 — Dashboard KPIs

1. Log in as ADMIN, open `/dashboard`

**Expected**:

| Card | Shows |
|------|-------|
| Total users | real number (array length) |
| Active users | real number (`isActive === true`) |
| Active technicians | real number (`role === 'TECHNICIAN' && isActive === true`) |
| Open tickets | `—` placeholder, **no retry button** |
| Inventory alerts | `—` placeholder, **no retry button** |

Stop the API and reload:

**Expected**: the three real cards show an **error state with a retry button**; the placeholder cards still show `—` with **no** button. These two states must look different.

---

### Scenario 6 — Users list

1. Log in as ADMIN, open `/employees`

> The users page lives at **`/employees`**, not `/dashboard/employees`. `(dashboard)` is a Next.js *route group*, which contributes no URL segment — the route was always `/employees`, and `nav-config.ts` links to it there.

**Expected**:

- Page is labelled **"المستخدمون"** (Users) — the route path is unchanged
- Rows show email, role, active flag, created date. **There is no name column** — `UserDto` has no `name` field, and the old mock data's names were fabricated
- Role `CS` displays as a readable label, never the raw `CS`
- Sorting and filtering are client-side, with **no** network call
- No mock rows remain

---

### Scenario 7 — Empty vs failed

With zero users in the database:

**Expected**: the dashboard shows `—` on all three real KPI cards, and the users page shows the "no users" empty state (not a blank table).

This is deliberately different from a failed fetch, which offers retry.

---

### Scenario 8 — RBAC

1. Log in as a non-admin (e.g. TECHNICIAN)
2. Open `/employees`

**Expected**: an access-denied message, and no successful `GET /api/users`.

The client guard is a usability affordance only — the backend's `ADMIN` role check is the real enforcement.

---

### Scenario 9 — Password recovery

1. Open `http://localhost:3001/auth/forgot-password`
2. Submit a **registered** email, note the message
3. Submit an **unregistered** email

**Expected**: **identical** confirmation text for both (the endpoint always returns 200, to prevent account enumeration).

4. Use the reset link from the email

**Expected**: the new password works and the old one does not. A reused or expired token shows an explicit "this link is invalid or expired" message with a link back to `forgot-password` — not a generic failure.

> The emailed link is `${FRONTEND_URL}/auth/reset-password?token=…`. Both pages are now real routes under `app/auth/`. If they 404, either the move has been reverted or the backend is still generating the old `/reset-password` path.

---

### Scenario 10 — Backend gates

```bash
pnpm --filter @alfahd/types build
pnpm --filter @alfahd/api typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api test
pnpm --filter @alfahd/api test:e2e
pnpm --filter fahd-dashboard typecheck
pnpm --filter fahd-dashboard lint
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **`POST /auth/*` returns 500 "Internal server error", `GET /users` returns 401** | The `pg` pool cannot authenticate — `password authentication failed for user "alfahd"`. Usually a **native PostgreSQL service is listening on 5432 and shadowing the Docker container**, so the API talks to a different database than `docker compose` created | Check with `Get-NetTCPConnection -LocalPort 5432 -State Listen`. Either stop the native service, or point `DATABASE_URL` at the database that actually owns port 5432 |
| Dashboard and API fight over port 3000 | Next.js defaults to 3000, same as the API | Run the dashboard with `--port 3001` and set `API_URL=http://localhost:3000` |
| **`POST /api/...` returns the login page HTML** | The dashboard started on 3000, so `API_URL` points the rewrite back at itself | Pass `--port 3001` explicitly. `PORT` in `.env.local` does **not** set the Next.js port |
| **Refresh 401s after every reload** | Cookie `Path` does not match `/api/auth/*` | Must be `/`. Not `/auth` (never sent on `/api/auth/refresh`) and not `/api/auth` (never sent on `/dashboard`) |
| **Every page load bounces to login** | Middleware cannot see the cookie | Same root cause — check `Path=/`. If you set `/api/auth`, the guard fails on every page route |
| **Every page load bounces to login, cookie is present** | Cookie name does not match `refresh_token` | The guard reads `REFRESH_COOKIE_NAME` = `refresh_token`. `fahd-session` was removed and no longer satisfies the guard |
| `POST /api/...` returns a Next.js 404 | Rewrite missing or malformed | Check the `rewrites()` entry in `next.config.ts` and that `API_URL` is set |
| Redirected to login on a page you are allowed to see | `FRONTEND_URL` / `CORS_ORIGINS` still point at port 3000 | Set both to `http://localhost:3001` |
| Reset email link 404s | Backend generating `/reset-password`, route is `/auth/reset-password` | `auth.service.ts` must build `${FRONTEND_URL}/auth/reset-password?token=…` |
| Cross-tab sync never fires | Using a `storage` listener | Use `BroadcastChannel`; no `localStorage` write means no storage event is ever emitted |
| Logout does not clear the cookie | `clearCookie` path ≠ set path | Both must be `/` — both derive from `REFRESH_COOKIE_PATH` |
| Role shows raw `CS` | Display labels missing | Map `CS` → "خدمة العملاء" via `roleLabel()` in `core/auth/role-labels.ts`; the raw wire value is never rendered |
| Table shows blank name/status columns | Using the old `AuthUser` type | `UserDto` has no `name`, `department`, or `status` — those columns must be removed |
| Refresh response read as `undefined` token | Reading `refreshToken` off the refresh response | The field does not exist; the response carries `accessToken` only |
| Header shows a blank name | Reading `user?.name` | `UserDto` has no `name`; render `user?.email` |
| Login 429s during ordinary use | Login is limited to 5 attempts / 10 min / IP, and it counts **all** attempts including successes | Wait for the window to pass. No `Retry-After` header is sent, so the UI cannot show a countdown |
| `pnpm --filter @alfahd/api test:e2e` fails to connect | Redis/Postgres not running | `pnpm infra:up`. The `pg` pool connects lazily, so unit tests need no docker — e2e does |