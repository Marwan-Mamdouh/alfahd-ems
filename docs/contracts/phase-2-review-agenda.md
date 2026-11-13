# Phase 2 contract review agenda — technical freeze pending

Continuation of #67 on 2026-11-12. Read the [handoff](phase-2-handoff.md) and [wire catalog](phase-2-wire-contracts.md) first. The user confirmed the four choices below in this session; exact routes, DTOs and cross-owner interfaces still require review. This is not a reviewed A2 freeze or implementation evidence.

Concrete proposed routes, examples, security considerations and owner review questions are in [phase-2-proposed-contracts.md](phase-2-proposed-contracts.md). These are not existing endpoints.

## User-confirmed choices — 2026-11-12

- **Attendance:** configured attendance timezone, inclusive work-date filters and aggregates across all filtered stored records, independent of pagination. No generated ABSENT records. Exact routes, ordering, fields and bounds remain open.
- **People lookups:** ACTIVE only for new technician stock/router assignments and warehouse-manager selections; ON_LEAVE/INACTIVE historical references remain visible. Mutation targets must be revalidated server-side. Role/warehouse restrictions and bounded query details remain open.
- **Photos:** initially authenticated ADMIN/self bytes; superseded by the later user-approved public delivery and frontend URL construction decision below.
- **Products:** block deactivation until positive stock and active router usage are cleared; preserve historical identity/references. Exact definition of active usage, atomic safeguards, API, reactivation and historical selectors remain for supply review. No hard-delete UI is authorized.

These answers were given directly by the user in this session, not posted to GitHub. Named reviewer approval and staging acceptance remain outstanding. The table below retains the review context; its proposal column must be read together with these confirmed choices.

Follow-up: the user confirmed attendance department filters use the employee's **current** department, and stated existing photo assets are private. The user later explicitly permitted public photo access and frontend-built Cloudinary URLs, replacing the earlier private-byte decision. Provider settings and existing asset compatibility remain to be verified; no settings have been changed.

Attendance review: the user wants individual attendance history on the employee page, independent of department, while retaining the current-department filter on the overall ADMIN list. They agreed to newest-work-date-first ordering, 20 rows by default and a maximum of 100. A shared filtered endpoint remains the proposed implementation. The user chose contextual totals: date/employee/department filters apply, but the status filter does not; the table itself is status-filtered. A separate filtered pagination count is proposed and requires contract review.

Additional user-confirmed decisions: ACTIVE ADMIN or WAREHOUSE_STAFF may be chosen as warehouse managers; ACTIVE technicians may receive router/stock assignments across warehouses, with their assigned warehouse displayed. Authorized history/detail responses retain names for inactive people. Product deactivation is blocked by any linked router not DECOMMISSIONED, including LOST, as well as positive stock; ADMIN may reactivate, and inactive SKUs remain reserved. LOST resolution is not defined or implied. Exact wire shapes and implementation safeguards remain subject to developer review.

Lookup access: the user confirmed that ADMIN and WAREHOUSE_STAFF may request technician choices, while only ADMIN may request warehouse-manager choices. This is separate from the roles eligible to be selected.

Product review: the user confirmed that rejected deactivation should explain stock and/or router blockers without partial changes, and that repeating deactivation of an already-inactive product succeeds without duplicate history. Exact blocker response fields and reactivation retry behavior remain technical review items.

## Decisions to verify

| Gate | Existing behavior / approved direction | Proposal for discussion | Owner and required confirmation |
| --- | --- | --- | --- |
| Attendance reads (#69) | ADMIN list/history, date/employee/department/status filters, server-wide filtered totals; no read endpoint exists | User confirmed configured timezone, inclusive work dates and full-filter stored-record totals. | Marwan with bahaashahin: review proposed route, current versus historical department, fields, ordering and bounds. |
| Minimal people lookups (#75) | ADMIN/WAREHOUSE_STAFF bounded ID/name/status/warehouse choices; no email or national ID | User confirmed ACTIVE-only selections, manager roles, cross-warehouse technician choices and historical names. | Hamadaae with Marwan: review exact historical-label fields, limits, paths and mutation revalidation. |
| Persistent photos (#73) | Current employee read contains a storage key; upload is ADMIN-only. | User permits publicly shareable photo URLs and frontend-built Cloudinary transformations; upload remains ADMIN-only. | Marwan with bahaashahin: review identifier, transformations and fallback; storage owner verifies public delivery, replacement identifiers and cache behavior. |
| Product removal (#81) | Deactivate, preserve identity/history, exclude from new selectors; current DELETE is guarded hard removal | User confirmed positive stock or any non-DECOMMISSIONED router blocks deactivation; ADMIN reactivation and SKU reservation. | Hamadaae with Marwan: review exact API, atomic safeguards, LOST resolution and selector rules. |
| Formal acceptance (#89) | Staging gate retained; no local/demo waiver approved | Keep BLOCKED until staging is identified or an explicit written waiver names its scope and limitations. | Marwan: identify environment when available. No deployment work is implied. |

Approve or amend each choice independently. Approval of a direction is not reviewer approval of an exact wire contract. Record the decision's author, date and issue/comment reference when publishing is authorized; do not claim approval from silence.

## Remaining A2 drafting work

- [ ] Confirm the choices above with their owners; preserve unanswered items as gates.
- [ ] Review the [52-action standalone OpenAPI snapshot](phase-2-openapi.json), [supplementary history/multipart/download fragments](phase-2-openapi-fragments.md) and wire catalog against current source and actual response tests. Future contracts remain separate. Snapshot operation coverage is complete; exhaustive schema/error conformance and reviewer approval are not claimed.
- [ ] Review the proposed employee detail, attendance history, photo, stock movement, router audit and IP history interfaces and typed fixtures with the named owners.
- [ ] Supply remaining typed fixtures for detail/history, validation/conflict and job terminal states after the corresponding shapes are agreed; zero attendance totals and unavailable-photo props are present.
- [ ] Obtain explicit backend/UI review of role-specific capabilities, callbacks, shared-file writers and container ownership. Do not edit cross-owner production components to demonstrate agreement.
- [ ] Rebuild shared types and run relevant interface/contract checks on the updated baseline. Record exact commands/results separately from historical evidence.
- [ ] Share only when authorized; keep #67 open until reviewed work is merged and closure evidence is recorded.

## Revalidation evidence

Compared `7606270..97bcd31` and inspected current employees, attendance, products and jobs controllers, attendance query validation, response interceptor, exception filter and router/warehouse service changes. No API routes or production UI components were implemented in this continuation. Original November 8 verification remains historical; it is not acceptance evidence for current master. No real employee data, credentials or provider URLs are included.

First UI handoff update: proposed employee-detail/history, contextual attendance and public-photo identifier props/fixtures were added without network or production components. After `pnpm install --frozen-lockfile`, `pnpm --filter @alfahd/types build`, `pnpm --filter fahd-dashboard typecheck`, `pnpm --filter fahd-dashboard lint`, and `git diff --check` passed. This is static/type/lint evidence, not human review, an implemented endpoint or browser acceptance.

Contract example update: inspected current employee mapper, Cloudinary adapter, inventory controller and global exception filter. Parsed 21 fenced JSON examples across the handoff, wire catalog and proposal; `git diff --check` passed. `pnpm --filter @alfahd/api exec vitest run src/common/interceptors/response.interceptor.spec.ts src/database/schema/mappers.spec.ts src/modules/inventory/inventory.controller.spec.ts` passed 18 tests in 3 files. These tests cover existing behavior only; parsing and source inspection do not validate hypothetical endpoints, Cloudinary delivery or actual HTTP conformance. Complete reviewed OpenAPI fragments and named-owner review remain open.

Supply-history drafting: web typecheck and lint passed; `pnpm --filter @alfahd/api exec vitest run src/modules/inventory/inventory.controller.spec.ts src/modules/routers/routers.controller.spec.ts src/modules/ip-management/ip.controller.spec.ts` passed 33 tests in 3 files. Both YAML blocks parse using installed `js-yaml`; the first attempt using a nonexistent Next.js internal YAML module failed and was replaced. Parsing is not OpenAPI schema or live-response validation. No reviewer approval or complete OpenAPI coverage is claimed.

Additional upload/job drafting: added five implemented multipart, polling and binary-download operations and job schemas. A local script parsed all four YAML blocks and checked that all 11 operations have responses/security, path parameters are declared and all seven local schema references resolve. Source checking corrected the job status to `QUEUED` and optional download/error fields. This is not full OpenAPI specification validation, a live HTTP test or complete coverage of every action in the matrix.

Full action coverage continuation: `node docs/contracts/generate-phase-2-openapi.mjs` generated the standalone snapshot with 52 operations on 41 paths. A structural Node check verified unique operation IDs, declared path parameters, no 204 response bodies and resolved local schema references. Focused `pnpm --filter @alfahd/api exec vitest run src/common/interceptors/response.interceptor.spec.ts src/database/schema/mappers.spec.ts src/modules/inventory/inventory.controller.spec.ts src/modules/routers/routers.controller.spec.ts src/modules/ip-management/ip.controller.spec.ts src/jobs/jobs.service.spec.ts src/employees/employees.service.spec.ts` passed 59 tests in 7 files. This is not an independent OpenAPI validator or a per-route HTTP/schema conformance run. Schema precision, error applicability and owner review remain gates.

Independent validation: `pnpm --package=@redocly/cli dlx redocly lint docs/contracts/phase-2-openapi.json` passed after adding summaries and a relative server. It reports two warnings: missing license metadata (not invented) and potentially ambiguous existing paths `/ip-addresses/{id}/reserve` and `/ip-addresses/import/{id}` (different methods; inspect routing behavior rather than assuming a defect). Initial `pnpm dlx @redocly/cli ...` could not select an executable and the first correctly invoked lint found missing summaries/server; both were corrected. Lint checks document structure, not response fidelity or business approval. The snapshot's generic 400/404/409 entries are applicability notes, not claims every operation emits each status; exact error cases remain tied to source and wire catalog.
