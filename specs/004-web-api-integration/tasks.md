---

description: "Task list for Web API Integration (004)"
---

# Tasks: Web API Integration

**Input**: Design documents from `/specs/004-web-api-integration/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-contracts.md](./contracts/api-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: **No test tasks are generated.** The spec does not request TDD, and `apps/web` has **no test runner** — only `typecheck` and `lint`. Web behaviour is verified by the manual scenarios in `quickstart.md`. The one backend task (T004) updates an existing spec, which is not a new test task. Adding Vitest to `apps/web` is out of scope.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## ⚠️ Before starting: blocking gate

`checklists/delegation.md` (42 items) is the requirements-quality gate. **It is now fully checked** (42/42), so implementation is unblocked.

**Every task below has a documented wrong answer that still typechecks and lints.** These are listed in `plan.md` per task. T008 (cookie name) and T017 (user object on reload) are the two where a wrong answer silently breaks authentication with no error anywhere. Read the task's "Wrong answer" block before implementing it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths in every description

## Path Conventions

- **Backend**: `apps/api/src/...`, `apps/api/test/...`
- **Web app**: `apps/web/src/...`
- **Ports**: API on `3000`, dashboard on `3001` (they collide by default — see T002)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and dependencies. No story logic.

- [X] T001 Add `"@alfahd/types": "workspace:*"` to `dependencies` in `apps/web/package.json`, then run `pnpm install && pnpm --filter @alfahd/types build`
- [X] T002 Set `API_URL=http://localhost:3000` and `PORT=3001` in `apps/web/.env.local`; add the same keys to `apps/web/.env.example`; **delete** `NEXT_PUBLIC_API_URL` from both (a `NEXT_PUBLIC_` value is inlined into the client bundle and leaks the internal host)
- [X] T003 Add a `rewrites()` entry to `apps/web/next.config.ts` mapping `{ source: "/api/:path*", destination: \`\${process.env.API_URL}/:path*\` }` — the browser must reach the API same-origin so the refresh cookie is readable by middleware

**Checkpoint**: `curl -i http://localhost:3001/api/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"x"}'` returns a **backend** response (401), not a Next.js 404.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth plumbing and type correctness. **No user story work may begin until this phase is complete.**

**⚠️ The backend is already built.** Commit `ee32f3b` shipped the refresh cookie, CORS, `cookie-parser`, and both e2e suites. Do **not** re-implement them. Exactly one backend change remains: T004.

- [X] T004 Change `REFRESH_COOKIE_PATH` from `'/auth'` to `'/'` in `apps/api/src/config/refresh-cookie.ts` and update the assertion at `apps/api/src/config/refresh-cookie.spec.ts:39`. **Wrong answer:** `'/api/auth'` — RFC 6265 sends a cookie only on request paths it prefixes, so that value is never sent on `/dashboard` and the middleware guard redirects every user to login on every load. Verify: `pnpm --filter @alfahd/api test`

> **Baseline note — RESOLVED, no longer applies.** This run recorded on 2026-10-03 that `pnpm --filter @alfahd/api test` passed 58/58 across 6 of 8 files and that 2 files failed to load with `Error: An Application Control policy has blocked this file.`, and that `test:e2e` could not run at all. **Neither reproduced**: unit tests pass **65/65 across 8 of 8 files**, and e2e passes **42/42 across 3 of 3 files**. T004's cookie-`Path` change was therefore verified end-to-end, including the `Set-Cookie` assertions in `auth.e2e-spec.ts`. The WDAC/AppLocker restriction was specific to that earlier session.
>
> If those load errors ever return, they are a host policy issue unrelated to this code: (a) do not weaken or delete a test to make the suite green; (b) a CI run on an unrestricted host remains the authority for R11's e2e coverage.
- [X] T005 Replace the contents of `apps/web/src/core/api/types.ts`: delete `AuthUser`, `Role`, `Department`, `EmployeeStatus`, the `success` field from `ApiResponse<T>`, and `PaginatedResponse<T>`; re-export `Role` and `UserDto` from `@alfahd/types`; keep `ApiResponse<T>` as `{ data: T }`. `UserDto` is `{ id, email, role, isActive, createdAt }` — there is **no** `name`, `department`, `status`, or `warehouseId`
- [X] T006 Replace every `"CUSTOMER_SERVICE"` with `"CS"` in `apps/web/src/core/permissions/permissions.ts` (5 occurrences: `ips.view`, `customers.view`, `customers.manage`, `tickets.view`, `tickets.manage`) and import `Role` from `@alfahd/types`. **Wrong answer:** leaving the value — `hasPermission()` then never matches a real response and every non-admin is denied. The matrix must continue to cover all four roles (`ADMIN`, `WAREHOUSE_STAFF`, `CS`, `TECHNICIAN`) per FR-027
- [X] T007 [P] Add a `ROLE_LABELS` record and `roleLabel()` helper mapping `ADMIN`→"مدير النظام", `WAREHOUSE_STAFF`→"موظف مخزن", `CS`→"خدمة العملاء", `TECHNICIAN`→"فني" in a new file `apps/web/src/core/auth/role-labels.ts`. **The raw wire value must never be rendered**
- [X] T008 [US2] Replace `SESSION_COOKIE_NAME` with `export const REFRESH_COOKIE_NAME = "refresh_token" as const;` in `apps/web/src/core/auth/routes.ts`, keeping `LOGIN_PATH` and `DASHBOARD_PATH`. **Wrong answer:** any other name (`refreshToken`, `session`, `jwt`) — it compiles, the guard silently never matches, and every user is bounced to login with no error. Source of truth is `REFRESH_COOKIE_NAME` in `apps/api/src/config/refresh-cookie.ts`
- [X] T009 [US2] Rewrite `apps/web/src/core/auth/auth.store.ts`: delete the `persist` middleware and the `createJSONStorage` import, delete the `refreshToken` state field, change `setSession` to `(accessToken, user)`, delete both `document.cookie` writes, add an `isRestoring: boolean` field initialised to `true`. Keep `clearSession`, `selectIsAuthenticated`, `selectRole`. **Wrong answer:** keeping the parameter but ignoring it — the value stays in memory and remains XSS-readable, defeating FR-002
- [X] T010 [US2] Rewrite `apps/web/src/core/api/axios-instance.ts`: set `baseURL: "/api"`, keep `withCredentials: true`; **add** a request interceptor attaching `Authorization: Bearer <token>` from `useAuthStore.getState()` except on `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`; **rewrite** `refreshAccessToken()` to `POST /api/auth/refresh` with an **empty body** and store only the returned `accessToken` — **wrong answer:** reading `data.data.refreshToken`, which the response does not contain, so it writes `undefined` and forces a logout on the second 401; keep the existing `refreshPromise` single-flight and `_retry` guard; **add** GET-only auto-retry (max 2 attempts, ~300ms then ~900ms) per FR-021, never for `POST`/`PATCH`/`DELETE`; export a `logout()` helper calling `/auth/logout`

**Checkpoint**: `pnpm --filter fahd-dashboard typecheck` passes. Failures limited to `setSession` callers, fixed in the story phases below.

---

## Phase 3: User Story 1 — Real Authentication Integration (Priority: P1) — MVP

**Goal**: The login page authenticates against the real backend instead of a `setTimeout` mock.

**Independent Test**: Submit valid credentials → `POST /api/auth/login` returns 200, the `refresh_token` cookie is set with `httpOnly: true` and `path: /`, the user lands on `/dashboard`, and `document.cookie` does **not** contain `refresh_token` while `localStorage.getItem('fahd-auth')` is `null`.

- [X] T011 [US1] Update `apps/web/src/components/layout/header.tsx`: delete its local `ROLE_LABELS` (lines 9–14) and import it from `apps/web/src/core/auth/role-labels.ts` instead, which already maps `CS` correctly; replace the two `user?.name` reads (lines 32 and 38) with `user?.email`, since `UserDto` has no `name` field. Not marked `[P]`: it depends on T007 having created the shared helper
- [X] T012 [US1] Replace the `setTimeout` mock `handleSubmit` in `apps/web/src/app/auth/login/page.tsx` with a real `POST /api/auth/login`; call `setSession(accessToken, user)` with **two** arguments; do **not** store `refreshToken` even though the response body contains it; add controlled `email` and `password` state; remove the "وضع العرض التجريبي" demo-mode badge (lines 75–77)
- [X] T013 [US1] In `apps/web/src/app/auth/login/page.tsx`, add error handling: on 401 show one generic message identical for unknown email and wrong password — **wrong answer:** branching on status code or showing "account not found", which enumerates staff accounts. The login endpoint can return only 401, 429, or 5xx, so no other branch may reveal whether an account exists; on 429 show the rate-limit message (5 attempts per 10 min per IP) and honour `Retry-After`
- [X] T014 [US1] In `apps/web/src/app/auth/login/page.tsx`, add a `safeRedirect(raw)` helper returning `/dashboard` unless `raw` starts with `/` and does not start with `//` or `/\`, then call `router.push(safeRedirect(searchParams.get("redirect")))`. **Wrong answer:** `router.push(searchParams.get("redirect") ?? "/dashboard")` — a crafted link such as `/auth/login?redirect=https://evil.example` redirects an authenticated user off-origin (FR-028)
- [X] T015 [US1] Add a link to `/auth/forgot-password` in `apps/web/src/app/auth/login/page.tsx`. Include it even though T030 has not run yet — a 404 target is expected at this point, and omitting the link leaves no path to password recovery

**Checkpoint**: Login works end to end. `grep -rn "fake-access-token" apps/web/src` returns nothing.

---

## Phase 4: User Story 2 — Secure Token Storage & Session Management (Priority: P1)

**Goal**: The access token lives in memory only; the refresh token lives only in the `httpOnly` cookie; sessions survive reloads and propagate across tabs.

**Independent Test**: Log in, press F5, and the dashboard is still reachable with exactly one `/api/auth/refresh` call. Delete the cookie, reload, and you land on login with **no** retry loop.

- [X] T016 [US2] Create `apps/web/src/components/auth/session-restore.tsx`: call `POST /api/auth/refresh` exactly **once** on mount (empty body) guarded by a `useRef`; on 200 call `setSession(accessToken, userFromToken(accessToken))`; on 401 call `clearSession()`; while `isRestoring` render a full-page loader, not children. **Wrong answer:** reading `data.user` — the refresh response carries `accessToken` only, so this stores `undefined`
- [X] T017 [US2] In `apps/web/src/components/auth/session-restore.tsx`, add the local `userFromToken()` helper that base64-decodes the JWT payload segment and returns `{ id: sub, email, role, isActive: true, createdAt: "" }`. This is a **display source, not a security check** — the server already verified the token. **Wrong answers:** adding a `user` field to `RefreshTokenResponseDto` (breaks the frozen M4 #54 contract and the mobile client), or calling `GET /auth/me` (**wrong answer** — `endpoints.ts` declares it but the backend implements no such route, so it 404s)
- [X] T018 [US2] In `apps/web/src/components/auth/session-restore.tsx`, guard the logout race: if `clearSession()` ran while the restore was in flight, the late 200 must **not** call `setSession` — capture `sessionEpoch` before the await and skip `setSession` if it changed (or if a token was already set by a concurrent login)
- [X] T019 [US2] Mount `<SessionRestore />` in `apps/web/src/app/layout.tsx` next to the existing `<SessionExpiryRedirect />`
- [X] T020 [US2] Add a `BroadcastChannel('fahd-auth')` to `apps/web/src/components/auth/session-expiry-redirect.tsx`: broadcast on `clearSession()` and on logout; on receipt clear state and redirect to login within ~5s (SC-007); keep the existing `SESSION_EXPIRED_EVENT` listener for same-tab expiry; close the channel on unmount. **Wrong answer:** a `storage` event listener — with no `localStorage` write no storage event is ever emitted, so it is inert and silently never fires

**Checkpoint**: Reload restores the session; cross-tab logout propagates; no token is reachable from JavaScript.

---

## Phase 5: User Story 5 — Route Protection & RBAC Enforcement (Priority: P1)

**Goal**: Protected routes redirect unauthenticated users to login with a `redirect` parameter; role checks gate the pages.

**Independent Test**: With no cookie, visiting `/dashboard` redirects to `/auth/login?redirect=/dashboard`. A non-admin visiting `/employees` (`(dashboard)` is a route group and adds no URL segment) sees access-denied.

- [X] T021 [US5] In `apps/web/src/proxy.ts`, replace the `SESSION_COOKIE_NAME` lookup with `REFRESH_COOKIE_NAME` imported from `apps/web/src/core/auth/routes.ts`. Leave the `export const config = { matcher: [...] }` block unchanged — it correctly excludes `api`
- [X] T022 [US5] In `apps/web/src/proxy.ts`, keep the guard as a **presence check only** — do **not** attempt to validate the token. The refresh token is an opaque Redis UUID, so middleware cannot verify it without a network call per navigation. **Wrong answer:** adding a validation fetch inside middleware — it adds latency to every navigation and still cannot be authoritative. A stale cookie passes the guard and fails on the first API call with 401, which is the intended design
- [X] T023 [US5] Wrap the page content in `apps/web/src/app/(dashboard)/dashboard/page.tsx` with `<RoleGuard permission="dashboard.view">` from `apps/web/src/core/auth/guards.tsx`, per FR-027. Gate by the named permission — **wrong answer:** comparing `role === "ADMIN"` inline, which breaks silently whenever a role's permission set changes. Not marked `[P]`: the US3 phase edits the same file, so this completes first

**Checkpoint**: Unauthenticated navigation redirects; non-admins see access-denied on guarded pages.

---

## Phase 6: User Story 3 — Dashboard Data Integration (Priority: P1)

**Goal**: Three KPI cards show real numbers derived from `GET /users`; KPI cards with no data source show a static placeholder.

**Independent Test**: Log in as admin → three cards show real numbers, the tickets card shows `—` with no retry button. Stop the API → the three real cards show an error state **with** retry, visibly different from the placeholder.

- [X] T024 [US3] Add `"use client"` to `apps/web/src/app/(dashboard)/dashboard/page.tsx` (it is currently a server component) and fetch `GET /users` once via the axios instance
- [X] T025 [US3] Derive exactly three metrics in `apps/web/src/app/(dashboard)/dashboard/page.tsx`: total users (`data.length`), active users (`isActive === true`), active technicians (`role === "TECHNICIAN" && isActive === true`)
- [X] T026 [US3] Keep the tickets and inventory cards as static `—` placeholders with **no retry button** in `apps/web/src/app/(dashboard)/dashboard/page.tsx` — they have no data source (R7/R8). On fetch failure show `<ErrorState onRetry={...}>` on the three real cards only and `console.error` the failure. **Wrong answer:** giving the placeholder cards a retry control, which makes "no data source" indistinguishable from "fetch failed"
- [X] T027 [US3] Handle the empty-array case in `apps/web/src/app/(dashboard)/dashboard/page.tsx`: when the fetched array is `[]`, all three real cards show `—` (FR-023). Use `LoadingState` from `apps/web/src/components/shared/states` while loading

**Checkpoint**: Three real KPIs, one retry-free placeholder, error state distinct from placeholder.

---

## Phase 7: User Story 4 — Users List Integration (Priority: P2)

**Goal**: The users page lists real data from `GET /users` with client-side sort and filter.

**Independent Test**: Log in as admin, open `/employees` (`(dashboard)` is a route group and adds no URL segment) → rows show email, role label, active flag, created date. No `name` column, because `UserDto` has no name. Sorting reorders rows with no network call.

- [X] T028 [US4] Delete lines 1–82 of `apps/web/src/app/(dashboard)/employees/page.tsx` (a commented-out duplicate of the whole page) and remove `MOCK_EMPLOYES` plus the local `Employee` interface
- [X] T029 [US4] Fetch `GET /users` in `apps/web/src/app/(dashboard)/employees/page.tsx` and build columns for email, role label (via `roleLabel()` — **wrong answer:** rendering the raw wire value `CS`), active flag, and created date. Remove every `name` column: `UserDto` has no `name`, so such a column renders blank
- [X] T030 [US4] In `apps/web/src/app/(dashboard)/employees/page.tsx`: relabel the page "المستخدمون" (route stays `/employees` (`(dashboard)` is a route group and adds no URL segment) so bookmarks survive, per R9); wire the count badge to `data.length`; pass `isLoading`/`error`/`onRetry`/`emptyTitle` to the existing `DataTable` for FR-023; implement client-side sort and filter only and remove any `TablePagination` usage; wrap in `<RoleGuard permission="employees.manage">`

**Checkpoint**: Real rows, client-side sort, no mock data, no blank columns.

---

## Phase 8: User Story 6 — Password Recovery Integration (Priority: P2)

**Goal**: The forgot-password and reset-password pages call the real endpoints instead of showing a fake confirmation.

**Independent Test**: Both URLs return 200 (they 404 today). Submitting a registered and an unregistered email produce byte-identical confirmation text. A used or expired reset token shows an explicit expired-link message.

- [X] T031 [US6] Move `apps/web/src/core/auth/forgot-password/page.tsx` → `apps/web/src/app/auth/forgot-password/page.tsx` and `apps/web/src/core/auth/reset-password/page.tsx` → `apps/web/src/app/auth/reset-password/page.tsx`, then delete the emptied source directories. Keep the files byte-identical. **The route URL derives from the directory path** — `app/auth/forgot-password` yields `/auth/forgot-password`, matching `proxy.ts`. **Wrong answer:** editing the files where they sit — `src/core/` is not an App Router directory, so both URLs keep returning 404
- [X] T032 [US6] Replace the local-state mock `handleSubmit` in `apps/web/src/app/auth/forgot-password/page.tsx` with `POST /api/auth/forgot-password`, show the same confirmation for registered and unregistered addresses (the endpoint always returns 200), and remove the `TODO: Phase 2` comment
- [X] T033 [US6] In `apps/web/src/app/auth/reset-password/page.tsx`: read `token` via `useSearchParams()` from `next/navigation`; `POST /api/auth/reset-password` with `{ token, newPassword }`; on 400 show an explicit "this link is invalid or expired" message plus a link back to `forgot-password` — **wrong answer:** a generic error, which strands anyone who followed an old email; remove the `TODO (Phase 2)` comment; keep the existing 8-character minimum (it matches the backend) and add **no** client-side rule the server does not enforce (FR-025)

**Checkpoint**: Both routes 200, real endpoints called, expired token handled explicitly.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T034 [P] Update `specs/004-web-api-integration/contracts/api-contracts.md`: cookie table `Path` → `/` and `SameSite` → `Lax`, the `/api/*` rewrite and its consequences, the GET-only retry budget, `POST /users/change-password` → 201, and the 5-per-10-min login rate limit. Required by Constitution §V — a separate frontend developer codes against this file and M4 #54 will freeze it
- [X] T035 [P] Update `specs/004-web-api-integration/quickstart.md`: dashboard on 3001, `/api/...` paths, cookie `path: /`, the new troubleshooting rows, and a scenario for password recovery
- [X] T036 Confirm no secret leakage in `apps/web`. Check **behaviour, not prose** — several files mention these names in explanatory comments, so a naive `grep` over the whole tree gives false positives. The assertions that must hold:
  - `grep -rn "document\.cookie\s*=\|localStorage\.\|sessionStorage\.\|zustand/middleware\|\.refreshToken" apps/web/src` → **no matches** (the token is never written to or read from any JS-reachable store)
  - `grep -rn "NEXT_PUBLIC_API_URL\|fahd-session\|SESSION_COOKIE_NAME" apps/web/src` → matches only in comments explaining what was removed
- [X] T037 Run the full gate: `pnpm --filter @alfahd/types build && pnpm --filter @alfahd/api typecheck && pnpm --filter @alfahd/api lint && pnpm --filter @alfahd/api test && pnpm --filter @alfahd/api test:e2e && pnpm --filter fahd-dashboard typecheck && pnpm --filter fahd-dashboard lint`
- [X] T038 Walk all 10 validation scenarios in `specs/004-web-api-integration/quickstart.md` and confirm SC-001 through SC-014
- [X] T039 Review follow-ups: session epoch guard, public-route-safe restore, SameSite=Lax default, env boolean parsing, FRONTEND_URL=3001, per-card KPI states.
  > **Verified — 27/27 automated checks pass** against the real stack (Docker Postgres + Redis, API on 3000, dashboard on 3001), plus 5 browser-transport checks. Re-run with `pnpm infra:up`, `pnpm api:dev`, and `pnpm --filter fahd-dashboard dev -- --port 3001`.
  >
  > Confirmed live: **SC-001** login 200 through the rewrite in ~450ms; cookie `refresh_token` with **`Path=/`, `HttpOnly`, `SameSite=Lax`** (the T004 fix, observed on the wire); **SC-002/005** `{ data }` envelope, canonical `UserDto` (`id,email,role,isActive,createdAt` — no `name`/`department`/`status`), `GET /users` a bare unpaginated array, role `ADMIN` not `CUSTOMER_SERVICE`; **SC-006** unauthenticated `GET /users` → 401; **SC-010** exactly **one** `/api/auth/refresh` call on reload, no retry loop, response carries `accessToken` only; logout clears the cookie (`Path=/`, epoch `Expires`) and subsequent access **and** refresh both 401; **SC-013** registered and unregistered `forgot-password` return **byte-identical** 200s; **SC-014** a bogus reset token returns 400 naming the token, so the UI shows the expired-link panel; **FR-022** wrong-password and unknown-email 401s are byte-identical; login rate limit confirmed at 5 attempts → 429.
  >
  > **Two defects this pass found and fixed.** (1) `forgotPassword` let an email-delivery failure escape, so a registered address returned **500 while an unknown one returned 200** — an account-enumeration oracle, reachable whenever SMTP is down. Delivery errors are now swallowed and logged; pinned by 4 new tests in `apps/api/src/auth/auth.service.spec.ts`. (2) The e2e cookie assertions were updated for `Path=/`.
  >
  > **Not machine-verifiable here** (need a real browser, which this environment has no attachment for): SC-007 cross-tab `BroadcastChannel` redirect, and the `document.cookie` / `localStorage` half of SC-009. Their code-level preconditions *are* verified — `HttpOnly` is present on the wire so the token is unreadable from JS, and `grep` finds no `localStorage`/`sessionStorage`/`document.cookie` write anywhere in `apps/web/src`. Worth one manual pass in a browser before release.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Phase 1 — **blocks every user story**
- **User Stories (Phases 3–8)**: all depend on Phase 2. They may then run in parallel
- **Polish (Phase 9)**: depends on all desired stories

### Story Dependencies

- **US1 (P1, login)**: no story dependencies
- **US2 (P1, token storage)**: no story dependencies, but T016/T017 depend on T009's `setSession` signature
- **US5 (P1, route protection)**: T021 depends on T008's `REFRESH_COOKIE_NAME`
- **US3 (P1, dashboard)**: T024–T027 edit `dashboard/page.tsx`, which T023 also edits — T023 completes first (same phase order)
- **US4 (P2, users list)**: independent; shares `roleLabel()` with US3
- **US6 (P2, password recovery)**: T032/T033 depend on T031; otherwise independent

### Within Each Story

- Types and constants before the code that imports them
- Auth store before the axios interceptors and pages that read it
- T031 (route move) before T032/T033 — editing a file outside `app/` changes dead code
- Commit after each task or logical group

### Parallel Opportunities

- T007 and T008 run in parallel (new file vs `routes.ts`)
- T012–T015 all edit `login/page.tsx`, so they are **one sequential group** on one worker; T011 on `header.tsx` runs in parallel with that whole group
- T034 and T035 run in parallel (different documents)
- After Phase 2 completes, US1, US2, US5, and US6 can proceed in parallel on different files

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Different files, no interdependency:
Task: "Add REFRESH_COOKIE_NAME constant in apps/web/src/core/auth/routes.ts"   # T008
Task: "Add role-label helper in apps/web/src/core/auth/role-labels.ts"        # T007
```

## Parallel Example: User Story 1 (after T007)

```bash
# Two workers, disjoint files:
Worker A: T011  → apps/web/src/components/layout/header.tsx
Worker B: T012, T013, T014, T015 → apps/web/src/app/auth/login/page.tsx  (one worker, one file)
```

## Parallel Example: User Stories after Phase 2

```bash
# One worker per story — disjoint file sets:
Task: "US1 login page"      → apps/web/src/app/auth/login/page.tsx
Task: "US2 session restore" → apps/web/src/components/auth/session-restore.tsx
Task: "US5 proxy guard"     → apps/web/src/proxy.ts
Task: "US6 route move"      → apps/web/src/core/auth/{forgot,reset}-password/ → apps/web/src/app/auth/
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + US1)

1. Phase 1: Setup (T001–T003)
2. Phase 2: Foundational (T004–T010) - **blocks everything**
3. Phase 3: US1 login (T011–T015)
4. **STOP and VALIDATE**: log in with real credentials, confirm the cookie attributes, confirm no token in JavaScript

US1 alone is not a shippable product without US2 — without session restore a page reload loses the session — but it is the smallest verifiable increment.

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. US1 + US2 → **a working authenticated session** (MVP: login survives reload, logout propagates)
3. US5 → route protection complete
4. US3 + US4 → data-driven dashboard and users list
5. US6 → password recovery
6. Polish → contract and quickstart aligned

### Parallel Team Strategy

After Phase 2, split by file ownership to avoid conflicts:

- **Worker A**: US1 (`login/page.tsx`) + US5 (`proxy.ts`)
- **Worker B**: US2 (`session-restore.tsx`, `session-expiry-redirect.tsx`)
- **Worker C**: US3 (`dashboard/page.tsx`) + US4 (`employees/page.tsx`)
- **Worker D**: US6 (`app/auth/*`)

T023 (RoleGuard wrap) touches `dashboard/page.tsx`, which Worker C also edits in the US3 phase. T023 is sequenced into the US5 phase precisely so it finishes first — do not parallelise it into Worker C's phase.

---

## Notes

- `[P]` tasks = different files, no dependencies
- Every task has a **"Wrong answer"** line where a plausible mistake typechecks and silently breaks auth — read it
- `apps/web` has **no test runner**: T037 and T038 are the real verification
- Commit after each task; use conventional prefixes (`feat:`, `fix:`) per `AGENTS.md`
- Stop at any checkpoint to validate the story independently
- Avoid same-file conflicts — two workers must not edit one file
