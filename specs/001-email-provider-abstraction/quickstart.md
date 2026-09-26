# Quickstart: Email Provider Abstraction

**Date**: 2026-09-26
**Feature**: [spec.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/spec.md)

## Prerequisites

- Docker Compose running (`pnpm infra:up`) — needed for Redis/Postgres (the API won't boot without them)
- `apps/api/.env` exists (copy from `.env.example` if not)
- `@alfahd/types` built: `pnpm --filter @alfahd/types build`

## Setup

1. **Install the new dependency**:
   ```bash
   pnpm --filter @alfahd/api add @sendgrid/mail
   ```

2. **Update `.env`** with SendGrid config:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_real_or_test_api_key_here
   EMAIL_FROM=noreply@alfahd.local
   ```

## Validation Scenarios

### Scenario 1: Successful Boot with SendGrid

```bash
# Set EMAIL_PROVIDER=sendgrid and SENDGRID_API_KEY in .env
pnpm api:dev
```

**Expected**: API starts successfully. Console shows log line: `EmailModule: Using email provider: sendgrid`

### Scenario 2: Fail-Fast — Missing SendGrid API Key

```bash
# In .env, set EMAIL_PROVIDER=sendgrid and remove/comment SENDGRID_API_KEY
pnpm api:dev
```

**Expected**: API crashes at startup with Zod validation error naming `SENDGRID_API_KEY`.

### Scenario 3: Fail-Fast — Unimplemented Provider

```bash
# In .env, set EMAIL_PROVIDER=smtp
pnpm api:dev
```

**Expected**: API crashes at startup with error: `Unsupported EMAIL_PROVIDER: smtp` (or similar "not implemented" message).

### Scenario 4: Unit Tests Pass

```bash
pnpm --filter @alfahd/types build
pnpm --filter @alfahd/api typecheck
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api test
```

**Expected**: All checks pass, including new `email.module.spec.ts` tests.

### Scenario 5: DI Wiring Verification

After successful boot (Scenario 1), check Nest debug logs to confirm `EmailModule` is loaded and `EmailService` is available in the DI container. This can be verified via a simple controller or by checking `app.get(EmailService)` in a test.

## Artifacts Reference

- Interface contract: [contracts/email-provider.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/contracts/email-provider.md)
- Data model: [data-model.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/data-model.md)
- Research findings: [research.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/research.md)
