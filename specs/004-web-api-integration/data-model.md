# Data Model: Web API Integration

**Date**: 2026-10-01
**Feature**: Web API Integration (004)

## Overview

This feature is frontend-only. The data models below represent the TypeScript interfaces used by the frontend to communicate with the existing backend API. All types are sourced from `@alfahd/types` (shared package) or defined locally in `apps/web/src/core/api/types.ts`.

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

### LoginResponse

The inner payload of `POST /auth/login` (wrapped as `{ data: LoginResponse }`).

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | Short-lived JWT (default 15 min) — stored in memory |
| `refreshToken` | `string` | Opaque UUID (7 days, Redis `rt:{userId}:{tokenId}`) — stored in memory, sent in refresh body |
| `user` | `UserDto` | Authenticated user profile |

### ApiResponse<T>

Standard API response wrapper. Note: the backend wraps success payloads as `{ data }` with no `success` flag, and errors as `{ statusCode, message, path, timestamp }` — the frontend type must match this, not invent a `success` field.

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T` | Response payload |

**Source**: `apps/web/src/core/api/types.ts`

### PaginatedResponse<T>

Not used by this feature — `GET /users` returns the full array with no pagination metadata. The employees table paginates client-side only.

## Enums (match backend exactly)

### Role

Backend values (`roleEnum` in schema, `Role` in `@alfahd/types`). Note: customer service is `CS`, not `CUSTOMER_SERVICE` — the frontend maps it for display via `toFrontendRole()`.

```typescript
const Role = {
  ADMIN: 'ADMIN',
  WAREHOUSE_STAFF: 'WAREHOUSE_STAFF',
  CS: 'CS',
  TECHNICIAN: 'TECHNICIAN',
} as const;
type Role = (typeof Role)[keyof typeof Role];
```

### Department / EmployeeStatus

Not part of the user table or `UserDto` — do not use in this feature. (`Department` values in `@alfahd/types` are placeholders pending client confirmation.)

## State Transitions

### Session State (no rotation — refresh reuses the same tokenId)

```
[Logged Out] → login() → [Logged In]
[Logged In] → logout() → [Logged Out] (tokenId denylisted `rv:{tokenId}`)
[Logged In] → token expired → refresh() → [Logged In] (new access token, same refresh token)
[Logged In] → refresh failed → [Logged Out]
[Logged In] → admin revokes/deactivates → effective at next refresh/login, not on in-flight token
```

### Auth Store State (Zustand)

| State | Type | Initial Value |
|-------|------|---------------|
| `user` | `AuthUser \| null` | `null` |
| `accessToken` | `string \| null` | `null` |
| `refreshToken` | `string \| null` | `null` |

**Actions**:
- `setSession(accessToken, refreshToken)` — stores tokens in memory
- `setUser(user)` — stores user profile
- `clearSession()` — clears all state and removes session cookie

## Validation Rules (backend-enforced, `ValidationPipe` with `whitelist: true`)

- **Email**: Must be valid email format (create + update)
- **Password**: Minimum 8 characters on create and change-password
- **Role**: Must be a valid `Role` enum value on create/update
- **Access token**: JWT from `Authorization: Bearer` header, verified against `JWT_ACCESS_SECRET`, claims `sub`, `email`, `role`, `jti`
- **Refresh token**: Opaque UUID in request body, resolved via Redis `rt:{userId}:{tokenId}` (7-day TTL)

## Relationships

```
AuthUser 1 ← → 0..* Session (via userId)
Session 1 ← → 1 RefreshToken (via tokenId)
```
