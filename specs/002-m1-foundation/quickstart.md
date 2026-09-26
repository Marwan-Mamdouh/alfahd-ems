# Quickstart Validation Guide: M1 Foundation

This guide outlines how to validate the M1 Foundation infrastructure and backend logic.

## Prerequisites
- Node.js >= 22.12
- pnpm >= 11.26
- Local Docker instances running (PostgreSQL 16, Redis 7-alpine)
- Valid `.env` file configured in `apps/api/` with Database URL, Redis URL, and SendGrid API Key.

## Setup
1. Start infrastructure:
   ```bash
   pnpm infra:up
   ```
2. Build shared types:
   ```bash
   pnpm --filter @alfahd/types build
   ```
3. Run database migrations:
   ```bash
   pnpm --filter @alfahd/api db:push
   ```
4. Start the API in dev mode:
   ```bash
   pnpm api:dev
   ```

## Validation Scenarios

### Scenario 1: Infrastructure & Auth Check
1. Hit `POST /auth/login` with invalid credentials 6 times from the same IP.
   - **Expected**: First 5 requests return `401 Unauthorized`. The 6th request returns `429 Too Many Requests`.
2. Hit `POST /auth/login` with valid seed Admin credentials.
   - **Expected**: Returns `200 OK` with an `accessToken` (JWT) and a `Set-Cookie` header containing the `refreshToken`.
3. Check Redis for the refresh token using `redis-cli`:
   - **Command**: `KEYS rt:*`
   - **Expected**: A key matching `rt:{adminUserId}:{tokenId}` exists.

### Scenario 2: RBAC & User Management
1. Using the Admin `accessToken`, create a new WAREHOUSE_STAFF user via `POST /users`.
   - **Expected**: Returns `201 Created` with the new user details.
2. Authenticate as the new WAREHOUSE_STAFF user.
3. Attempt to hit `GET /users` using the WAREHOUSE_STAFF token.
   - **Expected**: Returns `403 Forbidden` (RBAC guard enforcement).
4. Deactivate the new user using the Admin token via `PATCH /users/:id` with `{ "isActive": false }`.
5. Attempt to login as the deactivated user.
   - **Expected**: Returns `401 Unauthorized` or `403 Forbidden` because the account is not active.

### Scenario 3: Admin Session Revocation
1. Authenticate as any user to generate a session (refresh token stored in Redis).
2. Using the Admin token, call `POST /users/:id/revoke-session` for that user.
3. Check Redis for the revoked user's refresh token.
   - **Expected**: The token key is deleted from Redis.
4. Attempt to use the revoked user's refresh token on the `POST /auth/refresh` endpoint.
   - **Expected**: Returns `401 Unauthorized` and logs a security alert.

### Scenario 4: Password Reset (SendGrid)
1. Hit `POST /auth/forgot-password` with a valid user email.
   - **Expected**: Returns `200 OK`. SendGrid dashboard (or local email capture tool) shows an email dispatched.
2. Use the token from the email to hit `POST /auth/reset-password`.
   - **Expected**: Password is successfully updated, allowing login with the new password.
