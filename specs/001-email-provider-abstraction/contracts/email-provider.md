# Email Provider Interface Contract

**Date**: 2026-09-26
**Feature**: [spec.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/spec.md)

## EmailProvider Interface

This is the core contract that all email adapters implement. Consumers inject `EmailService` (which wraps this interface) — they never interact with adapters directly.

### `send(options: SendEmailOptions): Promise<void>`

Sends an email through the configured provider.

**Input** (`SendEmailOptions`):

```typescript
interface SendEmailOptions {
  to: string | string[];   // Recipient(s)
  subject: string;         // Subject line
  text: string;            // Plaintext body
  html?: string;           // Optional HTML body
}
```

**Output**: `Promise<void>` — resolves on success, rejects on failure.

**Error behavior**:
- Invalid recipient → provider-specific error propagated to caller
- Provider unavailable → provider-specific error propagated to caller
- Timeout (10s for SendGrid) → timeout error propagated to caller
- Empty `to` → provider-specific error propagated to caller

**Caller responsibilities**:
- Retry logic (if desired)
- Rate limiting (if needed)
- Error handling / user-facing messages

## DI Token

```typescript
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
```

Injected via NestJS DI. The factory in `EmailModule` selects the adapter based on `EMAIL_PROVIDER` env var.

## EmailService (Public API)

```typescript
@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  async send(options: SendEmailOptions): Promise<void> {
    // Log at info (success) / warn (failure) level
    // Delegates to this.provider.send(options)
  }
}
```

**Usage by callers**:

```typescript
// Any module can inject EmailService (module is @Global)
constructor(private readonly emailService: EmailService) {}

// Send an email
await this.emailService.send({
  to: 'user@example.com',
  subject: 'Password Reset',
  text: `Click here to reset your password: ${resetUrl}`,
});
```

## Extensibility Contract

To add a new email provider (e.g., Resend):

1. Create `apps/api/src/email/adapters/resend.adapter.ts` implementing `EmailProvider`
2. Add provider-specific env vars to `env.validation.ts` with a conditional `superRefine`
3. Add a `case 'resend':` branch in the factory switch in `email.module.ts`
4. No caller changes — they inject `EmailService`, not the adapter
