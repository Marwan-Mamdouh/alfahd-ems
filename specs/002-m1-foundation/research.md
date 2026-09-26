# Phase 0: Outline & Research

## Technical Context Decisions

No critical unknowns were identified in the technical context that require further research for this milestone. All major architectural decisions (NestJS ESM, Drizzle ORM, PostgreSQL, Redis, SendGrid) are locked in by the project constitution.

### Technology Choices & Best Practices
- **NestJS ESM**: The project mandates `"type": "module"`. All local imports must use `.js` extension.
- **Drizzle ORM**: Used for PostgreSQL. Schema lives in `apps/api/src/database/schema/`.
- **Soft-Delete**: All entities must use soft-deactivation (e.g. `is_active` or `deleted_at`).
- **Rate Limiting**: Centralized in Redis to ensure limits are enforced globally.
- **Token Management**: JWT for short-lived access tokens (15m), Redis for long-lived refresh tokens (7d).
- **Email**: SendGrid is used for dispatching transactional emails (password resets).
