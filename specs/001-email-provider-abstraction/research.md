# Research: Email Provider Abstraction

**Date**: 2026-09-26
**Feature**: [spec.md](file:///g:/repos/alfahd-ems/specs/001-email-provider-abstraction/spec.md)

## R1: `@sendgrid/mail` — ESM Compatibility & API Surface

**Decision**: Use `@sendgrid/mail` v8.x as the SendGrid adapter dependency.

**Rationale**: The package supports ESM via default export (`import sgMail from '@sendgrid/mail'`). It provides `setApiKey()`, `setTimeout()`, and `send()` methods — all three are needed for this feature. The package is MIT-licensed, ~60 KB, actively maintained by Twilio/SendGrid.

**Alternatives considered**:
- Raw `fetch()` against the SendGrid v3 REST API — rejected because `@sendgrid/mail` handles auth headers, payload formatting, and error parsing. Rebuilding that is wasted effort for a well-maintained SDK.
- `nodemailer` with SendGrid SMTP relay — rejected because it adds a second dependency and SMTP relay has lower throughput limits than the API.

**Key findings**:
- **ESM import**: `import sgMail from '@sendgrid/mail'` (default export)
- **API key**: `sgMail.setApiKey(apiKey)` — must be called before any `send()`
- **Timeout**: `sgMail.setTimeout(10000)` — milliseconds, global to the instance. Configured once in the adapter constructor.
- **Send**: `sgMail.send({ to, from, subject, text, html })` — returns `Promise<[ClientResponse, {}]>`
- **Multiple recipients**: `to` accepts `string | string[]` natively
- **Error shape**: Throws an object with `response.body.errors` on API failure (4xx/5xx)

## R2: Conditional Zod Refinement Pattern

**Decision**: Use Zod `.superRefine()` on the existing `envSchema` to enforce provider-specific required fields.

**Rationale**: `.superRefine()` allows adding multiple conditional issues in a single pass. `.refine()` can only add one message. Since we need to validate different sets of fields depending on `EMAIL_PROVIDER`, `.superRefine()` is cleaner.

**Alternatives considered**:
- Zod discriminated union (`z.discriminatedUnion('EMAIL_PROVIDER', [...])`) — rejected because the env object has dozens of other fields unrelated to email; restructuring the entire schema around the email provider discriminant is disproportionate.
- Runtime check in the factory instead of Zod — rejected because it runs after `ConfigModule` has already validated and parsed env. The fail-fast guarantee is strongest at the Zod layer.

**Key findings**:
- Chain `.superRefine()` after the existing `.refine()` for Redis
- When `EMAIL_PROVIDER === 'sendgrid'`, assert `SENDGRID_API_KEY` is present
- When `EMAIL_PROVIDER === 'smtp'`, no SMTP-specific validation needed (stub throws at boot regardless)
- The existing `SMTP_HOST/PORT/USER/PASS` fields remain `.optional()` — they'll become required when a real SMTP adapter is built

## R3: NestJS Global Module + Factory Provider Pattern

**Decision**: Follow the existing `DatabaseModule` and `RedisModule` patterns for DI wiring.

**Rationale**: Consistency. Both existing infra modules use `@Global()` + factory providers injecting `ConfigService`. The email module does the same, keeping the codebase predictable.

**Key findings from existing patterns**:

| Aspect | `DatabaseModule` | `RedisModule` | `EmailModule` (planned) |
|--------|-------------------|---------------|-------------------------|
| Decorator | `@Global()` | None (not global) | `@Global()` |
| Token | `DRIZZLE`, `DRIZZLE_POOL` | `REDIS_CLIENT` | `EMAIL_PROVIDER` |
| Factory | `useFactory` + `ConfigService` | `useFactory` + `ConfigService` | `useFactory` + `ConfigService` |
| Lifecycle | `OnModuleDestroy` (pool.end) | `OnModuleInit` (ping), `OnApplicationShutdown` (quit) | `OnModuleInit` (log provider) |
| Exports | `DRIZZLE`, `DRIZZLE_POOL`, `DatabaseService` | `REDIS_CLIENT` | `EmailService` |

**Note**: `RedisModule` is not `@Global()` but `DatabaseModule` is. Email is cross-cutting (password-reset, user management, future notifications), so `@Global()` is appropriate — matches `DatabaseModule`.

## R4: Test Strategy

**Decision**: Unit tests only, following the `redis.module.spec.ts` pattern. No e2e tests for this ticket.

**Rationale**: The email module has no database interaction and no HTTP endpoints. All external calls (`@sendgrid/mail`) are mocked. The `redis.module.spec.ts` proves this pattern works well — test the factory, the DI wiring, and the adapter logic with mocks.

**Test cases planned**:
1. Factory selects `SendGridAdapter` when `EMAIL_PROVIDER=sendgrid`
2. Factory throws "not implemented" for `smtp`, `mailgun`, `postmark`, `ses`
3. Factory throws for unknown provider values
4. `SendGridAdapter` calls `sgMail.setApiKey()` and `sgMail.setTimeout(10000)` in constructor
5. `SendGridAdapter.send()` delegates to `sgMail.send()` with correct payload shape
6. `EmailService.send()` delegates to the injected provider
7. `EmailModule` wires correctly through Nest DI (using `Test.createTestingModule`)
