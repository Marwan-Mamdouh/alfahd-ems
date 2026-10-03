# API Contracts: Web API Integration

**Date**: 2026-10-01 (amended)  
**Feature**: Web API Integration (004)

## Overview

These contracts define the interface between the Next.js frontend and the NestJS backend. **No new endpoints are introduced.** `login`, `refresh`, and `logout` gain `httpOnly` cookie handling, and the app enables credentialed CORS — both required by spec Revision (2) R1/R4.

**Wire format (global, from `main.ts` `ResponseInterceptor`):** every success response is wrapped as `{ "data": <payload> }` — there is no `success` flag. This wrapping is **unconditional**: it applies to every endpoint in this document, including the ones that return `{ "ok": true }`. Errors return `{ "statusCode": <n>, "message": "<text>", "path": "<url>", "timestamp": "<iso>" }`. Examples below show the **inner payload**; the frontend must always unwrap one `data` level first (the `unwrap()` helper in `axios-instance.ts` does this).

> **Correction from the previous revision of this file.** It previously listed, as side effects, that login "sets an `httpOnly` cookie" and that refresh "rotates the refresh token (old one invalidated)" and "sets a new `httpOnly` cookie". Neither was true of the backend at the time of writing: there was no cookie handling anywhere in `apps/api`, and `AuthService.refresh()` returns a new access token while re-signing with the **same** token id. Those statements described intended behaviour that did not exist. Cookie behaviour below is now real and implemented by this feature; **rotation still does not happen** and must not be assumed.

## CORS (implemented — required for mobile, not for the web dashboard)

`main.ts` previously called no `enableCors()`. Credentialed CORS is now enabled and remains **required for the mobile app**; the web dashboard reaches the API same-origin through the rewrite below and does not exercise it.

| Setting | Value | Why it cannot be looser |
|---------|-------|------------------------|
| `origin` | Explicit allowlist from `CORS_ORIGINS` (comma-separated) | A wildcard `*` is **rejected by browsers** on credentialed requests |
| `credentials` | `true` | Otherwise the browser drops the `Set-Cookie` and never sends the cookie back |
| `allowedHeaders` | `Content-Type`, `Authorization` | The dashboard sends a bearer header on every authenticated request |
| `methods` | `GET, POST, PATCH, DELETE, OPTIONS` | Matches the users CRUD surface |

## Authentication Endpoints

### POST /auth/login

Authenticates a user and returns tokens.

**Request**:
```json
{
  "email": "user@fahdgroup.com",
  "password": "securePassword123"
}
```

**Response (200)** — wrapped as `{ "data": { ... } }`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
  "user": {
    "id": "uuid",
    "email": "user@fahdgroup.com",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2026-09-27T10:00:00.000Z"
  }
}
```

**Response (401)**: Invalid credentials (`{ "statusCode": 401, ... }`)
**Response (429)**: Rate limited — 5 attempts per 10 minutes per IP (Redis sliding window; counts all attempts). Implemented by `RateLimitGuard` on `POST /auth/login` only.

> The guard throws a plain `HttpException`, so **no `Retry-After` header is actually sent** despite the frontend being specified to honour one. The frontend therefore shows the rate-limit message without a countdown. Clients must treat `Retry-After` as optional on a 429.

**Side Effects**:
- Backend creates a session in Redis
- **Backend sets the refresh cookie** (`Set-Cookie`), attributes below

> `refreshToken` is still present in the body. The web client ignores it and never stores it in JavaScript; the mobile client uses it. Returning it keeps one endpoint serving both transports.

**Cookie set on 200** — name `refresh_token`:
| Attribute | Production | Local HTTP |
|-----------|-----------|-------------|
| `HttpOnly` | yes | yes |
| `Secure` | yes | **no** |
| `SameSite` | `none` (default in production) | `Lax` |
| `Path` | `/` | `/` |
| `Max-Age` | 604800 (7d, matches the Redis session TTL) | same |

> **`SameSite` is environment-driven, and its default depends on `NODE_ENV`.** `refreshCookieOptions()` resolves it as: `REFRESH_COOKIE_SAME_SITE` env override → `none` in production → `Lax` otherwise. Production defaults to `None` for the mobile native client (a genuinely cross-site client); the **web dashboard does not need it** because the rewrite below makes every call same-origin, so `Lax` suffices there and is what local development gets.

> **`Path=/` is mandatory and is the single most breakable value in this contract.** Per RFC 6265 a cookie is sent only on request paths it prefixes. The browser-visible auth path is `/api/auth/*` (after the rewrite below) and middleware reads the cookie on `/dashboard`. `Path=/auth` is never sent on `/api/auth/refresh`, so session restore fails on every reload. `Path=/api/auth` is never sent on `/dashboard`, so the proxy guard redirects every user to login. Only `/` reaches both.
>
> The cost of `Path=/` is that the cookie is also attached to page navigations on the dashboard's own origin. Accepted: it is `httpOnly`, same-origin after the rewrite, and read only on `/api/auth/refresh`.
>
> `SameSite=None` **requires** `Secure`, which browsers only honour over HTTPS. A single hard-coded `SameSite=None; Secure` policy silently breaks cookie auth on `http://localhost` — presenting as "refresh always 401s" and looking like a frontend bug. The attribute stays environment-driven. `None` is retained only for the mobile native client, which is a genuinely cross-site client.

---

## Same-Origin Transport (web only)

The dashboard adds a Next.js `rewrites` entry mapping `/api/:path*` to the API base URL. The browser therefore requests `/api/auth/login`, never `https://api.railway.app/auth/login`.

| Concern | Effect on the web client |
|---------|--------------------------|
| Cookie origin | Same-origin (the dashboard's own domain), so middleware can read it — this is what makes the FR-008 guard possible at all |
| `SameSite` | `Lax` suffices; `None` is no longer needed for web |
| CORS | **Not exercised** by the dashboard. It remains enabled on the backend for the mobile app and direct consumers |
| Base URL | Relative `/api`, not `NEXT_PUBLIC_API_URL`. A `NEXT_PUBLIC_` value is inlined into the browser bundle and would leak the internal host |
| Env var | `API_URL`, server-only, consumed by `next.config.ts` |

The mobile client is **unaffected** — it calls the API origin directly and keeps using the request body for refresh.

---

### POST /auth/refresh

Exchanges a refresh token for a new access token. **Dual transport.**

**Request** — no body required for web clients; the token comes from the cookie:
```json
{}
```

Body fallback (mobile, and any client without a cookie jar):
```json
{
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Resolution order**: cookie first, then body. If neither is present → 401.

**Response (200)** — wrapped as `{ "data": { "accessToken": "..." } }`. **Returns the access token only.** No `refreshToken` field, no rotation — the same refresh token stays valid.

> The previous version of the frontend interceptor read `refreshToken` off this response and wrote it into the store. Since the field does not exist, this set the stored token to `undefined`, guaranteeing a forced logout on the second 401 in a session. The interceptor no longer reads it.

**Response (401)**: Invalid, expired, or revoked refresh token.

**Side Effects**:
- Backend validates the Redis session and denylist for the token id
- **None otherwise** — no rotation, no `Set-Cookie`

**Required client behaviour**: send the request with credentials (`withCredentials: true`), otherwise the cookie is not sent and the call 401s.

---

### POST /auth/logout

Revokes the current session.

**Request**: (requires `Authorization: Bearer <accessToken>`)

**Response (200)** — wrapped as `{ "data": { "ok": true } }`:
```json
{
  "ok": true
}
```

**Side Effects**:
- Backend revokes the session in Redis
- **Backend clears the refresh cookie** (`Max-Age=0`)

---

### POST /auth/forgot-password

Requests a password reset email.

**Request**:
```json
{
  "email": "user@fahdgroup.com"
}
```

**Response (200)** — wrapped as `{ "data": { "ok": true } }`:
```json
{
  "ok": true
}
```

**Note**: Always returns 200 to prevent email enumeration.

> **The 200 is unconditional.** `AuthService.forgotPassword` catches and logs email-delivery failures instead of propagating them. Letting the error escape produced **500 for registered addresses and 200 for unknown ones** — an account-enumeration oracle, reachable whenever SMTP is unavailable (any dev machine without MailHog, and any production mail outage). Clients must rely on the response being invariant, not merely on it usually being 200.

---

### POST /auth/reset-password

Resets password using a token from the reset email.

**Request**:
```json
{
  "token": "uuid-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response (200)** — wrapped as `{ "data": { "ok": true } }`:
```json
{
  "ok": true
}
```

**Response (400)**: Invalid or expired token

---

## User Endpoints

### GET /users

Returns all users (ADMIN only). Full array — no pagination parameters or metadata.

**Request**: (requires `Authorization: Bearer <accessToken>`)

**Response (200)** — wrapped as `{ "data": [...] }`:
```json
[
  {
    "id": "uuid",
    "email": "user@fahdgroup.com",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2026-09-27T10:00:00.000Z"
  }
]
```

**Response (403)**: Non-admin user

---

### GET /users/:id

Returns a single user by ID (ADMIN only).

**Response (200)**: `UserDto` object
**Response (404)**: User not found

---

### POST /users

Creates a new user (ADMIN only).

**Request**:
```json
{
  "email": "sara@fahdgroup.com",
  "password": "securePassword123",
  "role": "CS"
}
```

**Response (201)**: `UserDto` object (wrapped in `{ "data" }`)
**Response (409)**: `Email already in use`

---

### PATCH /users/:id

Updates a user (ADMIN only). Updatable fields: `email`, `role`, `isActive` only (no name). Sending `isActive: false` deactivates (soft-delete, never hard-delete).

**Request**:
```json
{
  "role": "TECHNICIAN"
}
```

**Response (200)**: Updated `UserDto` object (wrapped in `{ "data" }`)
**Response (400)**: `Admin cannot deactivate their own account` (self-deactivation)
**Response (404)**: `User not found`
**Response (409)**: `Email already in use`

---

### POST /users/change-password

Changes the authenticated user's own password (any authenticated role, not just ADMIN).

**Request**:
```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```

**Response (201)** — wrapped as `{ "data": { "ok": true } }`:
```json
{
  "ok": true
}
```

**Response (400)**: `Old password is incorrect`

> ⚠️ **Known contract/behaviour mismatch.** This endpoint, and `POST /users/:id/revoke-session`, actually return **201** (NestJS defaults `POST` to 201 and `UsersController` sets no `@HttpCode`), whereas this document previously said 200 and every endpoint in `AuthController` does set `@HttpCode(200)`. The e2e suite asserts the real 201. Clients should accept either until this is reconciled — ideally **before** the M4 #54 contract freeze, since the frontend developer codes against this document.

---

### POST /users/:id/revoke-session

Revokes all sessions for a user (ADMIN only).

**Response (201)** — wrapped as `{ "data": { "ok": true, "revoked": 3 } }`:
```json
{
  "ok": true,
  "revoked": 3
}
```

---

## Frontend API Client Behavior

### Axios Instance

```ts
axios.create({
  baseURL: '/api',          // relative — goes through the Next.js rewrite
  withCredentials: true,
  timeout: 30_000,
})
```

### Interceptors

1. **Request interceptor** (added by this feature — previously absent): attaches `Authorization: Bearer <accessToken>` to every request except `/auth/login`, `/auth/forgot-password`, and `/auth/reset-password`.
   > The interceptor did not exist before this feature. The only place a bearer header was ever set was inside the 401-retry path, so ordinary authenticated requests were issued unauthenticated and the server rejected them. Spec SC-002 was unsatisfiable until this was added.
2. **Response interceptor**: On 401 (excluding `/auth/login` and `/auth/refresh` themselves), performs a single-flight refresh and retries the original request **once** (`_retry` guard).

### Auto-Retry Policy (FR-021)

| Rule | Value |
|------|-------|
| Which methods | `GET` **only** |
| Max attempts | 2 (so up to 3 total network calls) |
| Backoff | ~300ms, then ~900ms |
| `POST` / `PATCH` / `DELETE` | **Never auto-retried** — replaying a mutation after a network timeout can duplicate writes, and the backend has no idempotency key to make replay safe |
| Interaction with 401 | Independent. The refresh-and-retry path is governed by the interceptors above |
| Manual retry | Always available on every error state, whether or not auto-retry was attempted |

### Single-Flight Refresh

At most one refresh request is in flight. Concurrent 401s await the same promise rather than each triggering their own refresh. The promise is cleared in a `finally` so a later 401 can refresh again.

### Session Restore on Mount

On app mount the frontend calls `POST /api/auth/refresh` **with an empty body** — the cookie carries the token. On success it populates the store; on 401 it clears state and leaves the user on login. It **must not retry in a loop**; guard it so it fires exactly once per page load.

> The refresh response contains `accessToken` **only** — no user object, and there is **no profile endpoint** (`endpoints.ts` declares `auth.me`, but the backend implements no `GET /auth/me`; calling it 404s). The frontend therefore decodes the display fields from the access token's JWT payload. This is a **display source, not a security check** — the server already verified the token. The contract is unchanged for this reason: adding a `user` field to `RefreshTokenResponseDto` would break the frozen M4 #54 contract and the mobile client. Note `createdAt` is not in the JWT either, so any created-date column must come from `GET /users`.

### Cross-Tab Sync

`BroadcastChannel` — **not** the `storage` event. With no token written to `localStorage`, no storage event is ever emitted, so a `storage`-based listener silently never fires.

### Route Guard (`proxy.ts`)

| Aspect | Behaviour |
|--------|-----------|
| Cookie read | `refresh_token` (from `REFRESH_COOKIE_NAME` in `apps/web/src/core/auth/routes.ts`) |
| Check | **Presence only.** The refresh token is an opaque Redis UUID, not a JWT, so middleware cannot validate it without a network call on every navigation |
| Removed | The old JS-writable `fahd-session` flag cookie is deleted — a flag that script can both read and write is not an authentication control |
| Failure mode | A stale or revoked cookie passes the guard and fails on the first real API call with 401, which clears the session. The API is the sole enforcement point (FR-009) |
| Matcher | Excludes `api`, so middleware never runs on rewritten backend calls |

The web app also defines `FORGOT_PASSWORD_PATH` (`/auth/forgot-password`) and `RESET_PASSWORD_PATH` (`/auth/reset-password`) as the public routes. These must match the `app/auth/*` directory names, since the App Router derives the URL from the directory.

### Role Values

The backend emits `CS`, **not** `CUSTOMER_SERVICE`. The frontend `Role` type must use `"CS"`; comparisons against `"CUSTOMER_SERVICE"` never match real responses. Display strings (`"Customer Service"`) are a UI concern and must never be sent to the backend.

### Error Handling

| Status | Frontend Behavior |
|--------|-------------------|
| 401 | Attempt refresh → retry once → if refresh fails, clear session and redirect to login |
| 403 | Show access-denied message |
| 429 | Show rate-limit message, honouring `Retry-After` **if present** (the backend does not currently send it) |
| 500 | Show generic error with retry option |
| Network error | Show "connection lost" message with retry |

### Password Recovery

Both pages are **in scope** and are wired to the real endpoints. Both now live under `src/app/auth/`, so they are reachable routes: `app/auth/forgot-password` serves `/auth/forgot-password` and `app/auth/reset-password` serves `/auth/reset-password`. (They previously sat in `src/core/auth/`, which is not an App Router directory — they were not routes and returned 404, while `proxy.ts` whitelisted both paths and the backend emailed links to a reset URL. That mismatch is resolved.)

> **Reset link path.** The backend builds the emailed link as `${FRONTEND_URL}/auth/reset-password?token=…`. It must match the App Router directory exactly — a link to `/reset-password` 404s and the user can never complete recovery.

| Endpoint | Status | Client behaviour |
|----------|--------|------------------|
| `POST /auth/forgot-password` | 200 always, even for an unknown email | Show **identical** confirmation for registered and unregistered addresses |
| `POST /auth/reset-password` | 200, or 400 for an invalid/expired/used token | On 400 show an explicit "link invalid or expired" message plus a route back to `forgot-password` — not a generic failure |

Client-side password rules must not exceed what the server enforces (min 8 characters). A rule shown to the user but not enforced server-side produces a confusing rejection.
