# Router transition contract — draft

**Status:** Draft; transition whitelist reflects the M2b DoD. Holder semantics and transaction interface require Ahmed's approval before freeze.

## Status transition whitelist

| From | Allowed destinations |
| --- | --- |
| AVAILABLE | ASSIGNED_TO_TECHNICIAN |
| ASSIGNED_TO_TECHNICIAN | INSTALLED_AT_CUSTOMER, RETURNED, DAMAGED, LOST |
| INSTALLED_AT_CUSTOMER | RETURNED |
| RETURNED | AVAILABLE, UNDER_REPAIR, DAMAGED |
| DAMAGED | UNDER_REPAIR, DECOMMISSIONED |
| UNDER_REPAIR | AVAILABLE, DECOMMISSIONED |
| LOST | None |
| DECOMMISSIONED | None |

The status values are `AVAILABLE`, `ASSIGNED_TO_TECHNICIAN`, `INSTALLED_AT_CUSTOMER`, `RETURNED`, `DAMAGED`, `UNDER_REPAIR`, `LOST`, and `DECOMMISSIONED`. A disallowed transition returns 400. A reason is required for the approved override/status operations but never bypasses this whitelist. Manual assignment is restricted to ADMIN and WAREHOUSE_STAFF; a router that is not AVAILABLE returns 409.

## Atomicity invariants

- Router creation and its initial WAREHOUSE custody row are one transaction.
- A status/holder change releases the prior open assignment and creates the next open assignment in the same transaction as the router update.
- Exactly one open custody row must exist for an active router; concurrent attempts must serialize, and a losing operation must not leave partial status or custody history.
- The transition operation must accept a caller-owned database transaction so M3a can include it in ticket closure. It must not independently commit.

## Decisions still open

Holder types are WAREHOUSE, TECHNICIAN and CUSTOMER. The approved target validation, physical holder mapping for every transition (especially DAMAGED, UNDER_REPAIR, LOST and DECOMMISSIONED), customer-reference representation, reason requirements by operation, and exact failure/error body are not specified here. Resolve these with Ahmed before freezing this contract or implementing dependent behavior. Status and physical custody must remain distinct concepts.
