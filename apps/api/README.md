# alfahd-ems API

REST API for the alfahd EMS (Enterprise Management System) built with NestJS 12.

## Environment Setup

1. Copy the example environment file:
```bash
cp apps/api/.env.example apps/api/.env
```

2. Edit `apps/api/.env` with your values. Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_HOST` + `REDIS_PORT` | Redis host/port (local) | `localhost` + `6379` |
| `REDIS_URL` | Redis URL (production/Railway) | `redis://user:pass@host:port` |
| `JWT_ACCESS_SECRET` | Access token secret (min 32 chars) | `your-super-secret-access-key` |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | `your-super-secret-refresh-key` |
| `EMAIL_PROVIDER` | Email provider | `smtp`, `sendgrid`, `mailgun`, `postmark`, `ses` |
| `EMAIL_FROM` | Sender email address | `noreply@example.com` |

Optional (with defaults):
- `PORT` (default: 3000)
- `NODE_ENV` (default: development)
- `JWT_ACCESS_EXPIRES_IN` (default: 15m)
- `JWT_REFRESH_EXPIRES_IN` (default: 7d)
- `SMTP_HOST` — SMTP host (optional, for `EMAIL_PROVIDER=smtp`; not yet used)
- `SMTP_PORT` — SMTP port (optional, for `EMAIL_PROVIDER=smtp`; not yet used)
- `SMTP_USER` — SMTP username (optional, for `EMAIL_PROVIDER=smtp`; not yet used)
- `SMTP_PASS` — SMTP password (optional, for `EMAIL_PROVIDER=smtp`; not yet used)

**Note:** Provide either `REDIS_URL` (production) OR both `REDIS_HOST` and `REDIS_PORT` (local Docker). SMTP fields are accepted but not validated or used until email delivery is implemented.

## Running the Application

```bash
# Development (watch mode)
pnpm api:dev

# Production build
pnpm api:build
pnpm --filter @alfahd/api start:prod
```

## Testing

```bash
# Unit tests
pnpm --filter @alfahd/api test

# E2E tests
pnpm --filter @alfahd/api test:e2e

# Test coverage
pnpm --filter @alfahd/api test:cov

# Type checking
pnpm --filter @alfahd/api typecheck

# Linting
pnpm --filter @alfahd/api lint
pnpm --filter @alfahd/api lint:fix
```

## API Response Shapes

### Success Response
All successful responses are wrapped in a `{ data }` envelope:

```json
{
  "data": "Hello World!"
}
```

```json
{
  "data": { "id": 1, "name": "Example" }
}
```

### Error Response
All errors follow a consistent shape:

```json
{
  "statusCode": 404,
  "message": "Not Found",
  "path": "/api/endpoint",
  "timestamp": "2026-09-12T10:30:00.000Z"
}
```

Validation errors (400):
```json
{
  "statusCode": 400,
  "message": "email must be an email, password must be longer than 8 characters",
  "path": "/auth/login",
  "timestamp": "2026-09-12T10:30:00.000Z"
}
```

## Project Structure

```
apps/api/
├── src/
│   ├── app.module.ts          # Root module
│   ├── main.ts                # Bootstrap (global pipes/filters/interceptors)
│   ├── config/
│   │   └── env.validation.ts  # Zod env schema
│   ├── common/
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts  # Global error format
│   │   └── interceptors/
│   │       └── response.interceptor.ts   # Global success format
│   ├── app.controller.ts
│   └── app.service.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── config/
│       └── env.validation.spec.ts
├── .env.example
├── package.json
└── tsconfig.json
```