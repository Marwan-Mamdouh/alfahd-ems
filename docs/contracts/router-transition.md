# Router transition contract — draft

**Status:** Supporting card. The [M2b implementation contract](m2b-supply-implementation.md) records the latest approved business decisions and takes precedence. Exact schema/interface details still require technical review.

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
- A status/holder change releases prior custody and creates a new assignment only when the resulting state requires a holder, in the same transaction as router/stock updates.
- At most one open custody row may exist. Damaged, repair, lost and decommissioned cases have empty custody. Physical condition/location are separate facts; a physically damaged AVAILABLE router may also have no holder. Concurrent attempts must serialize, and failed writes must not leave partial stock, status or custody history.
- The transition operation must accept a caller-owned database transaction so M3a can include it in ticket closure. It must not independently commit.

## Decisions still open

Holder types remain WAREHOUSE, TECHNICIAN and CUSTOMER. The latest approved empty-custody, physical-condition, location and stock behavior is in the M2b implementation contract. Its §12 lists the remaining technical freeze items, including exact condition values, target validation, interface and error bodies. Do not add AVAILABLE → DAMAGED or simulate an assignment to record warehouse damage.
