# Frontend Phase 2 Hardening — Follow-Up Plan

**Source**: code review of `feat/phase2-frontend` (#4158afe) against `origin/master`, checked against `PLAN.md` (§2b OI-02, §3 M2a/M2b, §4, §5 Risk 1, §6a WS-E, §7b) and `specs/005-m2a-hr-attendance`.
**State of the branch at review**: merges green (`typecheck` ✓, `lint` ✓, `next build` ✓); all files new and unlinked from nav/API; pages honestly labelled preview (`وضع المعاينة — بيانات تجريبية`).
**Goal**: turn the five preview modules into API-integrated dashboards for HR and Supply without replaying the enum/contract mistakes the review caught, and without committing scope that is still unresolved with the client (Risk 1).

~

## T-0 · Process: record the phase 2 scope as a spec (owner: Marwan, ~0.5 day)

The branch was built with no `/speckit-specify` cycle — no spec, no clarify, no frozen per-module scope (the only web spec is `004-web-api-integration`, which is phase 1 / auth wiring).

- [ ] Run `/speckit-specify` for `specs/006-phase2-frontend-hardening` (or a feature dir per module) with the preview module list as seed content; encode the decisions from this review (locked enums below, inventory gate in T-4) into the spec.
- [ ] `/speckit-clarify` on that spec; `/speckit-plan` pointing at PLAN.md §1 Constitution so the web agent reuses `@alfahd/types` and does not re-derive statuses.

## T-1 · Align all UI enums with `@alfahd/types` and the PLAN-locked sets (owner: WS-E; **must land before any API wiring**; ~1 day)

This is the only code-debt item that becomes a collision the moment the modules call the real API.

- [ ] `apps/web/src/components/routers/types.ts:8` — replace the local `RouterStatus` (`IN_STOCK | ASSIGNED | INSTALLED | RETURNED | DAMAGED`, 5 values) with an import from `@alfahd/types` (`AVAILABLE | ASSIGNED_TO_TECHNICIAN | INSTALLED_AT_CUSTOMER | RETURNED | DAMAGED | UNDER_REPAIR | LOST | DECOMMISSIONED`, 8 values). The local type shadows an exported name with a disjoint value set (PLAN.md §1: enums are one source of truth in `@alfahd/types`).
- [ ] Update `router-table.tsx`, `router-history-table.tsx`, `router-assignment-form.tsx` and the mocks/editor options to the 8 statuses.
- [ ] `employees` components (`employee-table.tsx`, `employee-form.tsx`, `employee-status-badge.tsx`): replace `status: "ACTIVE" | "INACTIVE"` with `EmployeeStatus` from `@alfahd/types` (`ACTIVE | ON_LEAVE | INACTIVE`); `ON_LEAVE` is a LOCKED phase-2 status (PLAN.md M2a DoD line 152) that the UI currently cannot represent.
- [ ] `attendance-status-badge.tsx`: remove the invented `ABSENT` entry (`PLAN.md` line 497: "No invented business logic") — `AttendanceStatus` in `@alfahd/types` is `ON_TIME | LATE` only. If ABSENT is wanted, raise it as a spec question first (it is not in SoW/SRS).
- [ ] `employee-form.tsx:43–48`: reuse `core/auth/role-labels.ts` instead of re-creating the role label map.
- [ ] Collapse the duplicated inline union `"INBOUND" | "OUTBOUND" | "RETURN"` (in both `warehouses/types.ts` and `inventory/types.ts`) into one shared preview type until the backend contract shapes it.

## T-2 · HR module completeness (owner: WS-E; do employees/attendance first — `openapi/employees` is the only frozen contract; ~2–3 days)

- [ ] Employee form: add `national_id`, `hire_date`, `profile_photo` (5 MB / jpeg+png mirror — spec 005 acceptance scenario 3) so the form covers the full `POST /employees` contract.
- [ ] Employee form: replace the free-text `warehouseName` ("temporarily") with a warehouse select drawn from the real `GET /warehouses` list once a read-only warehouse endpoint is consumable.
- [ ] Add the status-transition UI: `PATCH /employees/:id/status` with the mandatory `reason` field; explain in-UI that `INACTIVE` revokes sessions and `ON_LEAVE` does not (spec 005 acceptance scenarios 4–5).
- [ ] Attendance screens: add error-state patterns for the server-driven outcomes so smooth-mock does not hide them: >150 m check-in 400 with the distance in the message, 409 `ALREADY_CHECKED_IN`, cutoff/`LATE`. Confirm check-out keeps **no** GPS field (already correct — keep it that way).

## T-3 · Router lifecycle UI vs the M2b machine (owner: WS-E; **blocked until `openapi/supply` is frozen per PLAN §7b wave 3–4**; ~2 days)

- [ ] Router table/assignment forms: gate on `AVAILABLE` (not `IN_STOCK`) and represent the M2b transition whitelist so the UI offers exactly the legal next-statuses per row; no invented transitions.
- [ ] Router history table: show `from_status → to_status` + performed-by + reason; manual status override needs a `reason` input (M2b DoD).
- [ ] Warehouse screens (`warehouse-*.tsx`): wire to real CRUD once frozen; keep the delete-with-attached-technicians/routers 409 message surfaced.

## T-4 · DECISION GATE — generic inventory vs routers-only (owner: Marwan; must close **before** any further inventory UI work)

`inventory-preview` implements a full generic catalog (items, movements, `lowStockThreshold`) with no backend tables planned in any milestone. PLAN.md §5 Risk 1 is an unresolved client-sign-off contradiction that agents "must not resolve silently" — this preview resolves it visually.

- [ ] Get written client sign-off that routers-only satisfies SoW §2.1.6, **or** raise a change request.
- [ ] Until that closes: do **not** demo/ship `inventory-preview` to the client as if committed; keep it out of nav-config.
- [ ] If sign-off is routers-only: delete `inventory-preview/page.tsx` and `components/inventory/*` (the movements UI in `warehouses/` stays a question for the frozen supply contract).
- [ ] If sign-off is full scope: raise a change request, and the backend must plan inventory tables, an API and a new OpenAPI freeze **before** this UI is wired — this becomes a new milestone item, not a freebie next to M2b.

## T-5 · Preview-shell and form refactors (owner: WS-E; ~1 day; only after T-1 so the refactors don't touch to-be-renamed code twice)

- [ ] Extract a `PreviewPageShell` (gradient hero, preview banner, notification bar, view-mode toggle, back button — currently copy-pasted in 5 pages) into `components/shared/`.
- [ ] Forms (`employee-form`, `warehouse-form`, `inventory-item-form`): stop bypassing the `ui/` primitives — drop the hand-rolled `inputClass`/raw `<input>`/`<button>` in favour of `ui/Input`/`ui/Button`/`ui/Label`, as the filter components already do.
- [ ] One shared `StatusBadge` + per-module config instead of a bespoke badge component per module (and the inline one inside `router-table.tsx`).

## T-6 · Integration hygiene (owner: WS-E + Marwan review; final step before calling phase 2 "done")

- [ ] Decide nav exposure: either add the modules to `components/layout/nav-config.ts` behind the preview flag, or document the hard-coded URLs as demo-only. Currently they are reachable only by typing the URL.
- [ ] Wire `employees/` + `attendance-preview` against the real API first (frozen `openapi/employees`), swapping mocks for `core/api/*` calls in the page-level state only — the components are already prop-fed, keep it that way.
- [ ] Delete each `types.ts` "not confirmed back-end DTO" comment as its module's contract is frozen, replacing the local types with `@alfahd/types` + generated API types.
- [ ] Permission gating: confirm each module's role requirements exist in `core/permissions/permissions.ts` and match the server-side roles (UX mirror only — server remains the authority).

## Ordering

1. T-0 and T-4 are parallel and non-code; T-4 closes the only real scope risk.
2. T-1 immediately after merge (it hardens the mocks; no contract needed).
3. T-5 after T-1.
4. T-2 uses the frozen `openapi/employees`; T-3 waits for `openapi/supply` (PLAN §7b waves 3–4).
5. T-6 last — it converts phase 2 from previews into integrated dashboards.

Phase 3 (tickets/CRM wave per PLAN §6a) must not start until T-0's spec exists and T-4's decision is recorded: the CRM wave sits on top of the same enum-source-of-truth and OpenAPI-freeze rules.
