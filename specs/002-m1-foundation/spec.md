# Feature Specification: M1 Foundation

**Feature Branch**: `[002-m1-foundation]`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "/speckit-specify Create the spec for milestone M1 (Foundation) of the alfahd-ems project. Use the M1 section of the attached @[PLAN.md] as the seed: NestJS project setup, PostgreSQL+drizzle+Redis+SendGrid infra, the core users/warehouses schema, and the full auth/RBAC flow (login, refresh/logout, rate limiting, forgot/reset password, JWT+Roles guard, admin session revocation, user CRUD, change password). Turn the 13 issues into acceptance-criteria-driven requirements, not tasks yet. you may need to start form 5 and review the first 4 only as we already implement them but the review will be good"

## Clarifications

### Session 2026-09-27
- Q: Should the system prevent an Admin from deactivating their own account to avoid accidental lockout? → A: Yes, prevent self-deactivation (return 400 Bad Request) to ensure system recoverability.
- Q: How should the system respond when a user attempts to use a revoked refresh token? → A: Return 401 Unauthorized and log a security alert to track potential token theft.
- Q: How does the system handle concurrent login rate limiting across multiple backend instances? → A: Centralized rate limiting via Redis to ensure limits apply globally across all instances.
- Q: How does the system handle schema migrations during deployment? → A: Migrations are run manually or via a separate CI/CD job before deployment to prevent race conditions during scaling.
- Q: Where are password reset tokens stored and what is their TTL? → A: Redis key `pwd_reset:{token}` (value = userId), TTL = 1 hour (3600 seconds). Tokens are single-use and deleted after successful consumption.
- Q: Which email library is used? → A: Nodemailer (locked by project constitution and PLAN.md). SendGrid was considered but rejected. Do NOT use `@sendgrid/mail`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - System Initialization & Infrastructure (Priority: P1)

As a developer/system administrator, I need the foundational infrastructure and database schema in place so that the rest of the application can be built upon it.

**Why this priority**: Required before any application logic can function.

**Independent Test**: Can be tested by running the application, verifying successful connection to PostgreSQL (with Drizzle schema loaded) and Redis, and successfully sending a test email via SendGrid.

**Acceptance Scenarios**:

1. **Given** the application is configured with correct credentials, **When** the application starts, **Then** it successfully connects to the PostgreSQL database and Redis cluster.
2. **Given** a valid recipient, **When** an email dispatch is triggered, **Then** the email is successfully delivered via SendGrid.

---

### User Story 2 - User Authentication & Session Management (Priority: P1)

As a system user, I need to securely log in, stay authenticated across requests, and log out, so that my account remains secure and my session is managed properly.

**Why this priority**: Core security requirement before exposing any data endpoints.

**Independent Test**: Can be tested by authenticating with valid credentials, receiving tokens, accessing a protected route with the access token, refreshing the session, and successfully logging out to invalidate the session.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** a user logs in, **Then** they receive a 15-minute access token and a 7-day refresh token stored correctly (HTTP-only cookie or mobile storage).
2. **Given** multiple failed login attempts, **When** a user exceeds 5 attempts in 10 minutes from a single IP, **Then** further login attempts from that IP are rate-limited.
3. **Given** an active session, **When** the access token expires and a valid refresh token is provided, **Then** a new access token is issued.
4. **Given** an active session, **When** the user logs out, **Then** their refresh token is invalidated in Redis.

---

### User Story 3 - Role-Based Access Control (RBAC) (Priority: P1)

As an administrator, I need to ensure that users can only access endpoints authorized for their role (Admin, Warehouse Staff, CS, Technician).

**Why this priority**: Protects sensitive operations and data from unauthorized roles.

**Independent Test**: Testable by authenticating as different roles and verifying access to endpoints explicitly restricted to other roles.

**Acceptance Scenarios**:

1. **Given** an endpoint restricted to Admin, **When** a non-Admin user attempts access, **Then** a 403 Forbidden error is returned.
2. **Given** an active session for any user, **When** an Admin explicitly revokes their session, **Then** all their active refresh tokens are immediately invalidated in Redis.

---

### User Story 4 - User Account Management (Priority: P2)

As an administrator, I need to manage user accounts (create, read, update, deactivate) so that staff have the correct access to the system.

**Why this priority**: Necessary to onboard new employees and manage staff lifecycle.

**Independent Test**: Testable by an Admin creating a new user, updating their details, and deactivating them (ensuring no hard delete occurs).

**Acceptance Scenarios**:

1. **Given** Admin privileges, **When** I create or update a user, **Then** the changes are persisted in the database.
2. **Given** Admin privileges, **When** I delete a user, **Then** the user is only soft-deactivated and their record remains in the database.
3. **Given** an active user, **When** they request to change their password, **Then** they can do so securely.
4. **Given** a user who forgot their password, **When** they request a reset, **Then** they receive a secure reset link via email to regain access.

### Edge Cases

- Revoked token reuse: If a user attempts to use a revoked refresh token, the system returns 401 Unauthorized and logs a security alert to track potential token theft.
- Concurrent login rate limiting: Rate limiting is centralized via Redis to ensure limits are strictly enforced globally across all backend instances.
- Admin self-deactivation: An Admin attempting to deactivate their own account will receive a 400 Bad Request error to prevent accidental system lockout.
- Schema migrations: Migrations do not run automatically on startup; they are managed manually or via a separate CI/CD job before deployment to prevent race conditions during scaling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST initialize with NestJS (ESM), PostgreSQL, Drizzle ORM, Redis (ioredis + BullMQ), and Nodemailer for transactional email.
- **FR-002**: System MUST define the core schema including `users` and a stub for `warehouses`.
- **FR-003**: System MUST provide a login endpoint that returns a short-lived access JWT (15min TTL) and a long-lived refresh token (7-day TTL).
- **FR-004**: System MUST store refresh tokens in Redis using the pattern `rt:{userId}:{tokenId}`.
- **FR-005**: System MUST enforce a rate limit on the login endpoint of 5 attempts per 10 minutes per IP address.
- **FR-006**: System MUST provide token refresh and logout endpoints, properly invalidating refresh tokens in Redis on logout.
- **FR-007**: System MUST provide a secure password reset flow using Nodemailer for email delivery. Reset tokens are stored in Redis under key `pwd_reset:{token}` (value = userId) with a 1-hour (3600s) TTL and are invalidated immediately after use.
- **FR-008**: System MUST enforce RBAC using JWT and role-based guards, supporting roles: ADMIN, WAREHOUSE_STAFF, CS, TECHNICIAN.
- **FR-009**: System MUST allow an Admin to arbitrarily revoke any specific user's active session.
- **FR-010**: System MUST provide User CRUD endpoints restricted to the Admin role.
- **FR-011**: System MUST enforce soft-deactivation only (no hard deletes) for user records.
- **FR-012**: System MUST allow any authenticated user to change their own password.

### Key Entities

- **Users**: Core entity representing system actors. Attributes include credentials, role, status (active/deactivated).
- **Warehouses (stub)**: Foundation for future inventory/supply chain modules.
- **Sessions**: Ephemeral entities managed via Redis representing active user logins.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: API responds to authentication and protected route requests in under 200ms.
- **SC-002**: Rate limiting accurately blocks IPs after exactly 5 failed login attempts within a 10-minute sliding window.
- **SC-003**: 100% of deleted users remain in the database with a deactivated status, completely preventing login.
- **SC-004**: Password reset emails are dispatched to the external provider within 2 seconds of a valid request.

## Assumptions

- The infrastructure (Railway, Vercel) provisioning is handled or ready.
- Client applications will handle HTTP-only cookies (web) and secure storage (mobile) appropriately for refresh tokens.
- SendGrid account and verified sender identities are pre-configured.
