# Data Model: Email Provider Abstraction

**Date**: 2026-09-26
**Feature**: [spec.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/spec.md)

## Overview

This feature introduces no database tables. All entities are in-memory TypeScript types and interfaces used for dependency injection and method contracts.

## Entities

### SendEmailOptions (Value Object)

Represents the payload for a single email send operation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string \| string[]` | Yes | Recipient email address(es) |
| `subject` | `string` | Yes | Email subject line |
| `text` | `string` | Yes | Plaintext body |
| `html` | `string` | No | HTML body (optional, for future use) |

**Validation rules**:
- `to` must be non-empty (enforced by the adapter/provider, not by this type)
- `subject` and `text` must be non-empty strings
- `html` is optional; when absent, only plaintext is sent

### EmailProvider (Interface)

Defines the contract all email adapters must implement.

| Method | Signature | Description |
|--------|-----------|-------------|
| `send` | `(options: SendEmailOptions) => Promise<void>` | Sends an email. Throws on failure. |

**Implementations**:

| Adapter | Status | Behavior |
|---------|--------|----------|
| `SendGridAdapter` | ✅ Implemented | Calls `@sendgrid/mail` API. 10s timeout. |
| SMTP | ❌ Stub | Throws "not yet implemented" at boot. |
| Mailgun | ❌ Stub | Throws "not yet implemented" at boot. |
| Postmark | ❌ Stub | Throws "not yet implemented" at boot. |
| SES | ❌ Stub | Throws "not yet implemented" at boot. |

### EmailService (Facade)

Thin service layer that injects the active `EmailProvider` and delegates `send()`. Callers inject `EmailService`, never adapters directly.

## State Transitions

N/A — no stateful entities. Email is fire-and-forget from this module's perspective.

## Environment Configuration

| Variable | Type | Required | Condition |
|----------|------|----------|-----------|
| `EMAIL_PROVIDER` | `'smtp' \| 'sendgrid' \| 'mailgun' \| 'postmark' \| 'ses'` | Always | Existing enum, unchanged |
| `EMAIL_FROM` | `string` (email format) | Always | Sender address for all outbound emails |
| `SENDGRID_API_KEY` | `string` | When `EMAIL_PROVIDER=sendgrid` | API key for SendGrid v3 API |
| `SMTP_HOST` | `string` | Optional | Reserved for future SMTP adapter |
| `SMTP_PORT` | `number` | Optional | Reserved for future SMTP adapter |
| `SMTP_USER` | `string` | Optional | Reserved for future SMTP adapter |
| `SMTP_PASS` | `string` | Optional | Reserved for future SMTP adapter |
