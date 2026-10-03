# Data Model: Web API Integration

**Date**: 2026-10-02 (amended for shared-types dependency)
**Feature**: Web API Integration (004)

## Overview

The data models below describe the TypeScript interfaces the frontend uses to talk to the backend. **Every API type is imported from `@alfahd/types`** — the dashboard declares none of its own (Constitution §I). `apps/web` gains a `workspace:*` dependency on that package as part of this feature.

The backend side of these models already exists (`apps/api`, `@alfahd/types`) and is **not modified** by this feature, with one exception: the refresh cookie's `Path` changes to `/` (see RefreshCookie).

## Entities

### UserDto (canonical — from `@alfahd/types`, mapped by `toUserDto`)

The user profile returned by `POST /auth/login` and all `/users` endpoints. There is no `name`, `department`, or `warehouseId` field — the UI displays the email.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique user identifier (UUID) |
| `email` | `string` | User's email address (login identifier, unique) |
| `role` | `Role` | User's role for RBAC |
| `isActive` | `boolean` | Soft-activation flag (`false` = deactivated, never hard-deleted) |
| `createdAt` | `string` | ISO timestamp |

**Source**: `@alfahd/types` → `UserDto`

### LoginResponseDto

The inner payload of `POST /auth/login` (wrapped as `{ data: ... }`).

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | Short-lived JWT (default 15 min) — stored in **memory only** |
| `refreshToken` | `string?` | Opaque UUID (7 days, Redis `rt:{userId}:{tokenId}`). Present in the body for the **mobile** client. The **web** client ignores it and never stores it — the cookie carries it |
| `user` | `UserDto` | Authenticated user profile |

**Source**: `@alfahd/types`

### RefreshTokenResponseDto

The inner payload of `POST /auth/refresh`.

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | A new access token |

**No `refreshToken` field, and no rotation** — the same refresh token stays valid until logout or revocation. Any frontend code reading `refreshToken` off this response is reading a field that does not exist.

**Source**: `@alfahd/types`

### ApiResponse<T>

Success wrapper applied by the backend's `ResponseInterceptor` to **every** response, including `{ ok: true }` endpoints. There is **no `success` flag**.

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T` | Response payload |

Errors use a different shape: `{ statusCode, message, path, timestamp }`.

**Source**: `apps/web/src/core/api/types.ts` — the one envelope type the dashboard may keep locally, since it describes the interceptor's output rather than a domain entity.

### PaginatedResponse<T>

**Deleted by this feature.** `GET /users` returns the full array with no pagination metadata (spec R10). Keeping the type invites a model to add server pagination that does not exist.

## Enums (match backend exactly)

### Role

Canonical source: `@alfahd/types`, exported as an `as const` object (Constitution §VI — never the `enum` keyword).

```typescript
const Role = {
  ADMIN: 'ADMIN',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  CS: 'CS',
  TECHNICIAN: 'TECHNICIAN',
} as const;
type Role = (typeof Role)[keyof typeof Role];
```

**`CS` is the wire value** — not `CUSTOMER_SERVICE`. `apps/web` currently declares `"CUSTOMER_SERVICE"` in its own `Role` type, so `hasPermission()` comparisons against real responses silently never match. A display-label helper maps `CS` → "خدمة العملاء"; the raw wire value is never rendered.

### Department / EmployeeStatus

Not part of `UserDto` — do not use in this feature. `apps/web` declares both locally and must delete them.

### The frontend's `AuthUser` type — deleted

`apps/web/src/core/api/types.ts` currently declares `AuthUser` with `name`, `department`, `warehouseId`, and `status`. **None of these exist on `UserDto`.** Any column or label built on them renders blank. Replace with the shared `UserDto`.

## State Transitions

### Session State (no rotation — refresh reuses the same tokenId)

```
[Logged Out] → login() → [Logged In]
[Logged In] → logout() → [Logged Out] (tokenId denylisted `rv:{tokenId}`)
[Logged In] → token expired → refresh() → [Logged In] (new access token, same refresh token)
[Logged In] → refresh failed → [Logged Out]
[Logged In] → admin revokes/deactivates → effective at next refresh/login, not on in-flight token
```

### Auth Store State (Zustand) — after this feature

**No `persist` middleware, and no `localStorage` write of any kind.** The `refreshToken` field is **removed entirely** — the frontend must never hold it.

| State | Type | Initial Value |
|-------|------|---------------|
| `user` | `UserDto \| null` | `null` |
| `accessToken` | `string \| null` | `null` |
| `isRestoring` | `boolean` | `true` |

**Actions**:
- `setSession(accessToken, user)` — **two arguments.** The previous three-argument `(accessToken, refreshToken, user)` signature is what let the refresh token reach JS state.
- `clearSession()` — resets state; also broadcasts to other tabs over `BroadcastChannel`.

### RefreshCookie (server-set)

| Attribute | Value | Why |
|---|---|---|
| `HttpOnly` | always | Unreachable from JavaScript — the core XSS defence |
| `Path` | `/` | **Changed from `/auth` by this feature.** RFC 6265 sends a cookie only on request paths it prefixes. The browser-visible auth path after the `/api/*` rewrite is `/api/auth/*`, and middleware reads the cookie on `/dashboard`. `/auth` misses the first; `/api/auth` misses the second. Only `/` satisfies both |
| `SameSite` | `Lax` (web), `None` (mobile) | The rewrite makes web calls same-origin, so `None` is unnecessary — and harmful, since it would attach the cookie to every cross-site request to the dashboard. `None` is retained only for the mobile native client |
| `Secure` | production only | `SameSite=None` is rejected without `Secure`, which browsers only honour over HTTPS — the reason the attribute is environment-driven rather than hardcoded |
| `Max-Age` | 604800 (7d) | Matches the Redis session TTL so the browser copy never outlives the server session |

**Clear-on-logout must use the identical `Path`**, or the browser retains the cookie and the session appears to survive logout.

### Client-side flag cookie — deleted

`fahd-session` was written by `auth.store.ts` via `document.cookie` and read by `proxy.ts`. A value that any script can write is not an authentication control. The guard now reads the real cookie's **presence** — which it cannot validate, because the refresh token is an opaque Redis UUID, not a JWT. A stale cookie passes the guard and fails on the first real API call with 401. That is correct: the API is the enforcement point.

## Validation Rules (backend-enforced, `ValidationPipe` with `whitelist: true`)

- **Email**: Must be valid email format (create + update)
- **Password**: Minimum 8 characters on create and change-password
- **Role**: Must be a valid `Role` enum value on create/update
- **Access token**: JWT from `Authorization: Bearer` header, verified against `JWT_ACCESS_SECRET`, claims `sub`, `email`, `role`, `jti`
- **Refresh token**: Opaque UUID, resolved via Redis `rt:{userId}:{tokenId}` (7-day TTL). Web clients send it **only** in the `httpOnly` cookie; mobile clients send it in the request body. Never in JavaScript on the web.
- **Refresh response**: contains `accessToken` **only**. It carries no user object, so a page reload restores the token but not the profile — the plan must resolve how the user is recovered on mount (see `plan.md` T12) rather than assuming a field the backend does not return.

## Relationships

```
AuthUser 1 ← → 0..* Session (via userId)
Session 1 ← → 1 RefreshToken (via tokenId)
```
