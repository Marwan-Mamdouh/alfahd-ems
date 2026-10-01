# Research: Web API Integration

**Date**: 2026-10-01
**Feature**: Web API Integration (004)

## R-001: Token Storage Strategy

**Decision**: Access token in Zustand memory, refresh token in `httpOnly` cookie set by backend.

**Rationale**: 
- `localStorage` is vulnerable to XSS attacks — any malicious script can read tokens
- `httpOnly` cookies are inaccessible to JavaScript, preventing XSS-based token theft
- `Secure` flag ensures cookies are only sent over HTTPS
- `SameSite=Strict` prevents CSRF attacks by not sending cookies on cross-site requests
- The backend already returns tokens in the response body; it will be modified to also set a `Set-Cookie` header for the refresh token

**Alternatives Considered**:
- `localStorage` for both tokens — rejected due to XSS vulnerability
- `httpOnly` cookie for both tokens — rejected because the access token needs to be sent via `Authorization` header on every API call, which requires JavaScript access
- Backend-for-frontend (BFF) pattern — rejected as over-engineering for a single SPA consumer

## R-002: Refresh Token Rotation

**Decision**: Implement refresh token rotation — each refresh invalidates the old token and issues a new one.

**Rationale**:
- Prevents replay attacks where a stolen refresh token is reused
- The backend `SessionService` already supports session revocation via Redis
- The frontend axios interceptor already has single-flight deduplication logic for concurrent refresh requests

**Alternatives Considered**:
- No rotation (static refresh tokens) — rejected because a stolen token would remain valid until expiration
- Rotation with reuse detection — the backend already logs revoked token reuse as a security alert

## R-003: API Integration Pattern

**Decision**: Use the existing Axios instance with interceptors. No new HTTP client or API layer.

**Rationale**:
- The existing `axios-instance.ts` already has refresh-token interceptor with single-flight deduplication
- Adding a new HTTP client would introduce unnecessary complexity
- The interceptor already handles 401 → refresh → retry flow

**Alternatives Considered**:
- React Query / TanStack Query for data fetching — the project already has `query-provider.tsx` but the existing pages use direct Axios calls; introducing React Query now would be a larger refactor
- SWR — similar reasoning as above

## R-004: Dashboard KPI Data Strategy

**Decision**: Use `GET /users` for employee count. Show placeholder values for KPIs that require non-existent endpoints (tickets, inventory).

**Rationale**:
- The backend only has `/auth/*` and `/users` endpoints
- `GET /users` returns all users — the frontend can count active employees and technicians client-side
- KPIs for open tickets and low stock alerts have no data source — showing "—" is acceptable until those endpoints exist
- This aligns with the clarification that no new backend endpoints will be created

**Alternatives Considered**:
- Create new backend endpoints — explicitly out of scope per clarification
- Hide KPIs without data — rejected because it leaves the dashboard looking incomplete; placeholders communicate "data coming soon"

## R-005: Cross-Tab Session Expiry

**Decision**: Use `storage` event listener + `SESSION_EXPIRED_EVENT` for cross-tab session synchronization.

**Rationale**:
- When a user logs out in one tab, the `storage` event fires in other tabs
- The `SESSION_EXPIRED_EVENT` custom event handles same-tab expiry (e.g., refresh token failure)
- Both mechanisms call `clearSession()` and redirect to login

**Alternatives Considered**:
- BroadcastChannel API — more modern but less widely supported; `storage` event is sufficient for this use case
- Polling — wasteful and unnecessary

## R-006: Form Data Preservation on Session Expiry

**Decision**: Preserve form data in React state (not `localStorage`). After re-authentication, the user can resubmit.

**Rationale**:
- Form data may contain sensitive information — persisting to `localStorage` would be a security risk
- React state is lost on redirect to login, but the user can re-enter data after re-authentication
- For the current scope (login, dashboard, employees list), there are no complex forms that would benefit from persistence

**Alternatives Considered**:
- `sessionStorage` — slightly more secure than `localStorage` (cleared on tab close) but still accessible to XSS
- React Query cache persistence — over-engineering for current scope
