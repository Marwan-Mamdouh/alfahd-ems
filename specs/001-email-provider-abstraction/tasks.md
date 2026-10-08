---
description: "Task list for Email Provider Abstraction implementation"
---

# Tasks: Email Provider Abstraction

**Input**: Design documents from `specs/001-email-provider-abstraction/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Add `@sendgrid/mail` dependency to `apps/api/package.json`
- [X] T002 [P] Add `SENDGRID_API_KEY=` to `apps/api/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**🚨 CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Create `EmailProvider` interface, `SendEmailOptions` type, and `EMAIL_PROVIDER` token in `apps/api/src/email/email-provider.interface.ts`
- [X] T004 Update Zod environment schema in `apps/api/src/config/env.validation.ts` to enforce conditional validation for `SENDGRID_API_KEY` when `EMAIL_PROVIDER=sendgrid`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Send Email via Configured Provider (Priority: P1) 🏆 MVP

**Goal**: An administrator or automated system process triggers an email send. The system routes the message through whichever email provider is configured in the environment without the caller knowing or caring which provider is active.

**Independent Test**: Can be fully tested by injecting a mock provider behind the interface, calling `send()`, and verifying the message reaches the provider's API.

### Implementation for User Story 1

- [X] T005 [P] [US1] Implement `SendGridAdapter` in `apps/api/src/email/adapters/sendgrid.adapter.ts` with a 10-second HTTP timeout enforcement
- [X] T006 [US1] Implement `EmailService` in `apps/api/src/email/email.service.ts` which injects `EMAIL_PROVIDER` token and logs each send at info/warn level (never log email body)
- [X] T007 [US1] Implement `@Global()` `EmailModule` in `apps/api/src/email/email.module.ts` with a factory provider for `EMAIL_PROVIDER` returning `SendGridAdapter` for `sendgrid`
- [X] T008 [US1] Register `EmailModule` in the main application by importing it into `apps/api/src/app.module.ts`
- [X] T009 [US1] Write unit tests in `apps/api/src/email/email.module.spec.ts` to verify `EmailService` and `SendGridAdapter` behavior

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Fail Fast on Missing Provider Configuration (Priority: P1)

**Goal**: When the application starts, if the selected email provider's required credentials are missing or invalid, the system refuses to boot and logs a clear, actionable error message.

**Independent Test**: Can be tested by starting the application with `EMAIL_PROVIDER=sendgrid` but no `SENDGRID_API_KEY`, and verifying the process exits with a clear error.

### Implementation for User Story 2

- [X] T010 [P] [US2] Update `EmailModule` factory in `apps/api/src/email/email.module.ts` to throw "not yet implemented" errors for `smtp`, `mailgun`, `postmark`, and `ses` providers
- [X] T011 [US2] Write unit tests in `apps/api/src/email/email.module.spec.ts` to verify that selecting unimplemented providers throws at boot

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T012 [P] Verify Quickstart scenarios in `specs/001-email-provider-abstraction/quickstart.md`
- [X] T013 Run full typecheck, lint, and test suite `pnpm --filter @alfahd/api typecheck && pnpm --filter @alfahd/api test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2)

### Parallel Opportunities

- T002 can be executed in parallel with T001
- T005 can be implemented concurrently with other foundational/adapter tasks
- Testing (T009, T011) can run concurrently across stories
