# M2b supply decisions

**Status:** Business decisions confirmed by Marwan on 2026-10-28. Detailed handoff: [M2b implementation contract](../contracts/m2b-supply-implementation.md).

This record summarizes decisions from the planning discussion. The linked implementation contract supersedes earlier draft recommendations and lists the remaining technical freeze items. Business approval does not imply that implementation or acceptance checks have passed.

| # | Decision | Approved direction | Status |
| --- | --- | --- | --- |
| 1 | Router assets versus quantity stock | Each router references a product/SKU. Only AVAILABLE, serviceable routers physically in a warehouse contribute usable stock. Existing registration does not add quantity; new receipt does. Apply stock effects atomically. | Approved; onboarding/integration design needs technical freeze |
| 2 | Condition, custody and location | Separate physical condition from lifecycle. Damaged/repair/lost/decommissioned cases have empty custody; preserve history and separate physical location. Warehouse damage changes condition, not the transition whitelist. | Approved; exact field values/mapping need technical freeze |
| 3 | Status overrides | Require a reason; never bypass the whitelist. | Approved |
| 4 | IP rules | Individual IPv4 addresses; only FREE/RESERVED. Admin management and release; archive FREE only. Technician automatic allocation is one IP per installation ticket, idempotent and deferred until tickets exist. | Approved; DTOs/history details need technical freeze |
| 5 | CSV import | Async enqueue/poll with `{ inserted, skipped, errors }`; headers match the approved DB-column subset, processing is duplicate-tolerant with row outcomes. | Approved direction; limits/headers/polling need technical freeze |
| 6 | Authorization | ADMIN/WAREHOUSE_STAFF manual router assignment. Admin-only IP management, reports and CSV imports; technician IP read and later automatic allocation only. | Approved subset; other router operations and CS/warehouse IP reads remain unresolved |
| 7 | Report storage | Prefer Cloudinary with real Excel downloads; explicitly configured local disk is the temporary fallback. Fake storage is not acceptance evidence. | Approved M2b deviation from R2-only wording |
| 8 | Drizzle versions | Keep current versions/ranges unchanged; do not introduce exact pins or upgrades for this task. | Approved |

## Implementation gate

Ahmed should implement against the linked contract and review its §12 technical proposals with Marwan before the affected work. The wider client inventory-scope acceptance risk is not resolved by these decisions. No customer/ticket implementation is authorized by the future IP-allocation description.
