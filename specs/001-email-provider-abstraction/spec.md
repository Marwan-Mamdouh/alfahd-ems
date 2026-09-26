# Feature Specification: Email Provider Abstraction

**Feature Branch**: `001-email-provider-abstraction`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Build a swappable EmailModule behind an EmailProvider interface with a send(to, subject, body) contract. Ship SendGrid as the first adapter alongside the SMTP adapter. Part of M1 Phase 0 — Ticket #4 / Issue #5."

## Clarifications

### Session 2026-09-26

- Q: Should the email service log each individual `send()` attempt, or only log the provider selection at startup? → A: Log each `send()` call — recipient(s), subject, success/failure, provider used (info on success, warn on failure). Never log email body.
- Q: Does `EMAIL_FROM` need to support a display name format (e.g., `"Al Fahd EMS <noreply@alfahd.com>"`), or is a bare email sufficient? → A: Bare email address only. Keep the existing `.email()` Zod validation as-is. Display names deferred.
- Q: Should the SendGrid adapter enforce a timeout on the HTTP call, and if so, what maximum wait? → A: 10-second timeout. Long enough for normal operations, short enough to avoid blocking callers indefinitely.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send Email via Configured Provider (Priority: P1)

An administrator or automated system process (e.g., password-reset flow, temporary-password dispatch) triggers an email send. The system routes the message through whichever email provider is configured in the environment without the caller knowing or caring which provider is active.

**Why this priority**: Email delivery is the foundational capability. Without it, password-reset (M1 #9) and temporary-password flows (M1 #12) cannot function. Every downstream consumer depends on this single abstraction working correctly.

**Independent Test**: Can be fully tested by injecting a mock provider behind the interface, calling `send()`, and verifying the message reaches the provider's API. Delivers the ability to send emails from any part of the application through a single, swappable service.

**Acceptance Scenarios**:

1. **Given** the system is configured with `EMAIL_PROVIDER=sendgrid` and a valid `SENDGRID_API_KEY`, **When** the application sends an email with a recipient, subject, and body, **Then** the message is dispatched via the SendGrid API and no error is raised.
2. **Given** a caller invokes the email service, **When** the email is sent successfully, **Then** the caller receives a success confirmation without needing to know which provider was used.

---

### User Story 2 - Fail Fast on Missing Provider Configuration (Priority: P1)

When the application starts, if the selected email provider's required credentials are missing or invalid, the system refuses to boot and logs a clear, actionable error message — preventing silent failures where emails would silently fail at runtime.

**Why this priority**: A misconfigured email provider that only fails at send-time (e.g., during a real password reset) causes user-facing outages. Fail-fast at boot eliminates this entire class of incident.

**Independent Test**: Can be tested by starting the application with `EMAIL_PROVIDER=sendgrid` but no `SENDGRID_API_KEY`, and verifying the process exits with a clear error. No other feature needs to be built.

**Acceptance Scenarios**:

1. **Given** `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY` is missing, **When** the application starts, **Then** it crashes immediately with an error message indicating the missing API key.
2. **Given** `EMAIL_PROVIDER=smtp`, **When** the application starts, **Then** it crashes immediately with an error indicating the SMTP provider is not yet implemented.
3. **Given** `EMAIL_PROVIDER=mailgun` (an unsupported but valid enum value), **When** the application starts, **Then** it crashes immediately with an error indicating this provider is not yet implemented.

---

### Edge Cases

- What happens when the email recipient address is invalid? — The SendGrid API returns an error, which the email service propagates to the caller. The system does not silently swallow delivery errors.
- What happens when the email provider's external service is temporarily unavailable? — The `send()` call throws an error. The caller is responsible for retry logic (not built in this ticket; downstream consumers like password-reset will decide their own retry strategy).
- What happens when `EMAIL_PROVIDER` is set to a value not in the allowed enum? — Zod validation rejects it at boot, before the application module even initializes.
- What happens when `EMAIL_FROM` is not set? — Zod validation rejects it at boot, since `EMAIL_FROM` is a required field.
- What happens when the `to` field is an empty array? — The SendGrid client returns an error. No special handling at the abstraction layer.
- What happens when the SendGrid API call takes longer than 10 seconds? — The adapter throws a timeout error, which the email service propagates to the caller. The caller decides whether to retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a unified email-sending interface that accepts a recipient (single or multiple), subject, plaintext body, and optional HTML body.
- **FR-002**: The system MUST support a SendGrid adapter that sends emails via the SendGrid API using an API key configured in the environment.
- **FR-003**: The system MUST include an SMTP adapter stub that throws a "not yet implemented" error at boot when selected, matching the behavior of other unimplemented providers.
- **FR-004**: The system MUST select the active email provider based on the `EMAIL_PROVIDER` environment variable at application boot time.
- **FR-005**: The system MUST refuse to start (fail-fast) when required credentials for the selected provider are missing, with a clear error message.
- **FR-006**: The system MUST refuse to start (fail-fast) when `EMAIL_PROVIDER` is set to a provider that has no implemented adapter (e.g., `smtp`, `mailgun`, `postmark`, `ses`), with a clear "not implemented" error.
- **FR-007**: The system MUST use the `EMAIL_FROM` environment variable as the sender address for all outbound emails.
- **FR-008**: The system MUST be available for injection by any module in the application (cross-cutting, globally scoped).
- **FR-009**: The system MUST log which email provider was selected at startup.
- **FR-010**: The system MUST log each `send()` call at info level on success and warn level on failure, including: recipient(s), subject, and provider used. Email body content MUST NOT be logged.
- **FR-011**: The SendGrid adapter MUST enforce a 10-second timeout on each HTTP call to the SendGrid API. If the call exceeds 10 seconds, it MUST throw a timeout error.

### Key Entities

- **Email Message**: Represents an outbound email. Key attributes: recipient(s), subject, plaintext body, optional HTML body, sender address (from environment).
- **Email Provider**: Represents a transport mechanism for delivering emails (e.g., SendGrid API, SMTP relay). The active provider is determined by environment configuration.


## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Any module in the application can send an email by injecting the email service and calling `send()`, without any knowledge of which provider is active. Verified by at least one integration test using a mock provider.
- **SC-002**: The application refuses to start within 5 seconds when required email credentials are missing, producing an error message that names the missing variable. Verified by boot tests with intentionally incomplete configuration.
- **SC-003**: Adding a new email provider (e.g., SMTP, Resend) requires creating one new adapter file and adding one switch case — no changes to callers. Verified by documented extensibility instructions.
- **SC-004**: Selecting an unimplemented provider (`smtp`, `mailgun`, `postmark`, `ses`) causes the application to fail at boot with a clear error, verified by unit tests.

## Assumptions

- The existing `EMAIL_PROVIDER` enum in `env.validation.ts` (`smtp | sendgrid | mailgun | postmark | ses`) is kept as-is. Only `sendgrid` has a working adapter in this ticket; all others (`smtp`, `mailgun`, `postmark`, `ses`) throw "not implemented" at boot.
- The `@sendgrid/mail` npm package (MIT, ~60 KB) is an acceptable new production dependency.
- No `nodemailer` dependency is added. The SMTP adapter is a stub that throws at boot. A real SMTP implementation is deferred.
- Email body strings for password-reset and temporary-password flows are hardcoded inline at the call site — zero template abstraction. Templating is deferred.
- The email service does not implement retry logic, rate limiting, or queuing. Those concerns belong to the caller or a future enhancement.
- `EMAIL_FROM` is a bare email address (e.g., `noreply@alfahd.com`). Display name formatting (e.g., `"Al Fahd EMS <noreply@alfahd.com>"`) is deferred.
- The email module follows the same DI and architectural patterns as the existing `RedisModule` and `DatabaseModule`.
