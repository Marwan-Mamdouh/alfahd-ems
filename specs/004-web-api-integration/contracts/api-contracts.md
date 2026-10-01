# API Contracts: Web API Integration

**Date**: 2026-10-01 (amended)  
**Feature**: Web API Integration (004)

## Overview

These contracts define the interface between the Next.js frontend and the NestJS backend. **No new endpoints are introduced.** `login`, `refresh`, and `logout` gain `httpOnly` cookie handling, and the app enables credentialed CORS — both required by spec Revision (2) R1/R4.

**Wire format (global, from `main.ts` `ResponseInterceptor`):** every success response is wrapped as `{ "data": <payload> }` — there is no `success` flag. This wrapping is **unconditional**: it applies to every endpoint in this document, including the ones that return `{ "ok": true }`. Errors return `{ "statusCode": <n>, "message": "<text>", "path": "<url>", "timestamp": "<iso>" }`. Examples below show the **inner payload**; the frontend must always unwrap one `data` level first (the `unwrap()` helper in `axios-instance.ts` does this).

> **Correction from the previous revision of this file.** It previously listed, as side effects, that login "sets an `httpOnly` cookie" and that refresh "rotates the refresh token (old one invalidated)" and "sets a new `httpOnly` cookie". Neither was true of the backend at the time of writing: there was no cookie handling anywhere in `apps/api`, and `AuthService.refresh()` returns a new access token while re-signing with the **same** token id. Those statements described intended behaviour that did not exist. Cookie behaviour below is now real and implemented by this feature; **rotation still does not happen** and must not be assumed.

## CORS (added by this feature)

`main.ts` previously called no `enableCors()`, so cross-origin credentialed requests were impossible.

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
**Response (429)**: Rate limited — 5 attempts per 10 minutes per IP (Redis sliding window; counts all attempts)

**Side Effects**:
- Backend creates a session in Redis
- **Backend sets the refresh cookie** (`Set-Cookie`), attributes below

> `refreshToken` is still present in the body. The web client ignores it and never stores it in JavaScript; the mobile client uses it. Returning it keeps one endpoint serving both transports.

**Cookie set on 200** — name `refresh_token`:
| Attribute | Production | Local HTTP |
|-----------|-----------|-------------|
| `HttpOnly` | yes | yes |
| `Secure` | yes | **no** |
| `SameSite` | `None` | `Lax` |
| `Path` | `/auth` | `/auth` |
| `Max-Age` | 604800 (7d, matches the Redis session TTL) | same |

> `SameSite=None` **requires** `Secure`, which browsers only honour over HTTPS. A single hard-coded `SameSite=None; Secure` policy therefore silently breaks cookie auth on `http://localhost` — a failure that presents as "refresh always 401s" and looks like a frontend bug. The switch is driven by an environment value.
> `Path=/auth` scopes the cookie so it is **never attached to `GET /users`** or any other request, limiting exposure.

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
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,   // required: without it the refresh cookie is never sent
  timeout: 30_000,
})
```

### Interceptors

1. **Request interceptor** (added by this feature — previously absent): attaches `Authorization: Bearer <accessToken>` to every request except `/auth/login` and `/auth/refresh`.
   > The interceptor did not exist before this feature. The only place a bearer header was ever set was inside the 401-retry path, so ordinary authenticated requests were issued unauthenticated and the server rejected them. Spec SC-002 was unsatisfiable until this was added.
2. **Response interceptor**: On 401 (excluding `/auth/login` and `/auth/refresh` themselves), performs a single-flight refresh and retries the original request **once** (`_retry` guard).

### Single-Flight Refresh

At most one refresh request is in flight. Concurrent 401s await the same promise rather than each triggering their own refresh. The promise is cleared in a `finally` so a later 401 can refresh again.

### Session Restore on Mount

On app mount the frontend calls `POST /auth/refresh` with credentials. On success it populates the store; on 401 it clears state and leaves the user on login. **It must not retry in a loop** when no cookie is present.

### Cross-Tab Sync

`BroadcastChannel` — **not** the `storage` event. With no token written to `localStorage`, no storage event is ever emitted, so a `storage`-based listener silently never fires.

### Role Values

The backend emits `CS`, **not** `CUSTOMER_SERVICE`. The frontend `Role` type must use `"CS"`; comparisons against `"CUSTOMER_SERVICE"` never match real responses. Display strings (`"Customer Service"`) are a UI concern and must never be sent to the backend.

### Error Handling

| Status | Frontend Behavior |
|--------|-------------------|
| 401 | Attempt refresh → retry once → if refresh fails, clear session and redirect to login |
| 403 | Show access-denied message |
| 429 | Show rate-limit message, honouring `Retry-After` |
| 500 | Show generic error with retry option |
| Network error | Show "connection lost" message with retry |
