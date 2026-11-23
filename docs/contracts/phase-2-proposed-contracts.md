# Phase 2 decisions and open contract gaps

This register distinguishes implemented behavior on audited source `1ab7655dbf3571efc704e4707fc4af63820171b2` from owner-approved direction and work still needed. See the [wire catalog](phase-2-wire-contracts.md) for current requests and responses. Freeze verification on the eventual merged result is pending.

## Attendance list and employee history (#69)

Master implements ADMIN `GET /attendance` for both views. Employee history supplies `employee_id` without a department filter. The overall list filters on the employee's current department. Store and query inclusive local work dates using the configured attendance timezone; do not synthesize ABSENT records.

**Approved UI behavior:** Cards follow all selected filters (including status), count across every matching page, and do not count only the visible page. Keep the wire contract unchanged: use `filteredTotal` for pagination and the card total. Without a status filter, use `totals.onTime` and `totals.late`; with a status filter, use `filteredTotal` for the selected status and zero for the other. The API's contextual `totals` still ignore status and pagination. #71/#83 own live integration and tests that changing pages does not change the cards.

## Minimal eligible people lookups (#75)

Master has a single `GET /employees/lookup` endpoint for ADMIN and WAREHOUSE_STAFF with no purpose parameter. Both roles can query supported roles and statuses, and omitting `status` does not force ACTIVE-only results.

The issue owner approved this broader **minimal read**, superseding the previous purpose-specific read restriction. New technician selections use ACTIVE eligible technicians; router and inventory mutations revalidate eligibility. Cross-warehouse technician assignments remain allowed; show assigned warehouse when known.

**Approved manager contract:** Use a lookup-backed selector for ACTIVE ADMIN and WAREHOUSE_STAFF. Do not use the technician-only `isEligible` flag for managers. Retain an inactive or unknown existing assignment as current-only, not as an eligible new choice, and preserve it on unrelated edits. Master only accepts a manager UUID; require server-side eligibility validation for new or changed assignments. Warehouse writes remain ADMIN-only. Coordinate API work in #75 and selector delivery in #84.

**Approved history contract:** Authorized history/detail must resolve human-readable names for inactive people, separately from new-choice lookups. Master can fall back to an abbreviated ID without resolving the name. Under the affected inventory and router tickets (#77/#79), supply names through authorized history/detail data and display “Name unavailable” when the reference cannot be resolved.

## Public employee photo delivery (#73)

The issue owner confirmed public delivery: anyone with the URL may view or share the image. This supersedes private ADMIN/self delivery for the image bytes, **not** existing employee record authorization or ADMIN-only upload. The backend-owned container supplies a resolved `photoUrl: string | null`; the presentational component renders it or falls back to a placeholder, including when image load fails. It must not construct a provider URL from `profilePhotoKey`.

Master employee reads expose `profilePhotoKey`, and upload returns `{profilePhotoKey,url}`. **Approved #73 contract:** Add a nullable `photoUrl` to authorized employee list/detail responses, resolved by the API using the storage adapter. The container passes it to the UI. Do not invent a separate resolver endpoint or construct a provider URL in the UI. #73 owns implementation and provider verification: public asset compatibility, replacement/cache behavior, fallback/retry, and reload after successful upload. Old URLs and cached copies can remain accessible; no provider configuration or existing assets are changed by this handoff. Upload is multipart `file`, JPEG/PNG, maximum 5 MiB as implemented and specified by #73. After employee creation, retry only the failed upload against the saved employee ID without creating a second employee; this retry is separate from the image display fallback.

## Product deactivation (#81)

Master implements ADMIN `DELETE /products/:id` as guarded soft-deactivation (204, no body). Positive stock or a linked router in `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER` or `UNDER_REPAIR` blocks it with 409. The issue owner approved this four-state guard, superseding the earlier requirement to block on every non-`DECOMMISSIONED` router. `RETURNED`, `DAMAGED` and `LOST` do not independently block deactivation; stock is still checked separately. No router lifecycle transition is implied. Preserve identity, SKU and history; exclude inactive products from new selectors. Do not assume structured blocker counts.

**Approved inactive-product safeguards:** Exclude inactive products from new stock and router selectors, but retain them in authorized history and detail. Master filters the inventory selector but not the router create selector; stock writes and router creation do not verify product activity. Under #81, enforce activity for stock-creating writes and router onboarding under the existing product lock, and serialize deactivation against those writes. Review stock-restoring router transitions explicitly rather than applying a blanket lifecycle ban.

**Owner-approved #81 wire contract, not a current endpoint:** `POST /products/:id/reactivate` (ADMIN only, UUID, no request body) returns `204` with no body. Repeating it for an already-active product returns `204` without changing state or touching `updatedAt`. Invalid ID → `400`; no valid session → `401`; non-ADMIN → `403`; missing product → `404`, using the existing error envelope. Restore the original ID, SKU and history; inactive SKUs stay reserved. The container refreshes product lists/detail and selectors on success and supplies capability, pending/error state and `onReactivate(id): Promise<void>` to the UI. Test repeat requests, authorization, stable identity/history and selector refresh. Master has a repository helper but no API or UI action. Terra's owner-authorized supply/UI substitute dispositions cover the handoff; merged-result verification and the owner's freeze decision remain required. #81 tracks delivery; the implemented OpenAPI snapshot deliberately excludes the action.
