# M2b supply decisions

**Status:** Draft for Ahmed's review; no business decision below is approved by this document.

This record captures the decisions called out in `docs/m2b-gap-and-delivery-plan.md` §4. Recommendations are proposals only. Dependent implementation must wait for the relevant approval to be recorded in the feature specification or contract.

| # | Decision | Proposal for review | Status |
| --- | --- | --- | --- |
| 1 | Router assets versus quantity stock | Keep serial-level routers distinct from product quantities. Do not make router lifecycle operations change `warehouse_inventory` or stock movements unless an explicit accounting rule defines atomic synchronization. Also obtain client sign-off on the generic inventory scope risk identified in `PLAN.md` §6. | Open — Ahmed/client decision |
| 2 | Holder semantics | Treat status and physical custody as separate facts. Define a complete status-to-holder table, including `DAMAGED`, `UNDER_REPAIR`, `LOST` and `DECOMMISSIONED`, before implementation. Represent a future customer target without adding the M4a customer table or FK early. | Open — Ahmed decision |
| 3 | Status overrides | Require a reason where the operation requires an override, but never allow a reason to bypass the approved transition whitelist. | Consistent with current M2b DoD; confirm in contract |
| 4 | IP validation/history | Decide host-only versus CIDR input, allowed status transitions, reservation semantics, assignment inputs, reasons, and history actions for retirement/manual changes. | Open — Ahmed decision |
| 5 | CSV import | Proposed async job result: `{ inserted, skipped, errors }`, with row-numbered errors and duplicate-tolerant row processing. Freeze headers, normalization, encoding, limits, retries/idempotency, and polling shape before implementation. | Open — Ahmed decision |
| 6 | Authorization | Preserve the stated manual router assignment rule (ADMIN/WAREHOUSE_STAFF). Approve the remaining read/write/report/import matrix before other endpoints are implemented. | Partial — assignment rule in DoD; rest open |
| 7 | Report storage | `PLAN.md` names Cloudflare R2, while current storage implementations include Cloudinary/fake. Choose either the required R2 adapter or an explicitly approved M2b deviation; do not represent Cloudinary as R2-compliant. | Open — platform/client decision |
| 8 | Drizzle versions | Preserve semver ranges. Current declared ranges are `drizzle-orm: ^0.45.2` and `drizzle-kit: ^0.31.10`; the current lockfile resolves 0.45.3 and 0.31.11, respectively. These packages have different version lines; do not force matching version numbers. | Recorded in `PLAN.md`; verify compatibility when upgrading |

## Implementation gate

Ahmed should record approved answers in the feature specification or update the relevant contract. A proposal in this file is not sufficient authorization to implement unresolved business behavior.
