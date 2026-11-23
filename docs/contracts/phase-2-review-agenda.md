# Phase 2 contract review and closure agenda

Review [the handoff](phase-2-handoff.md), [wire examples](phase-2-wire-contracts.md), and the curated [OpenAPI snapshot](phase-2-openapi.json) against audited source `1ab7655dbf3571efc704e4707fc4af63820171b2` and the eventual merged result. Decisions are owner-approved; freeze verification remains pending. This is not an acceptance report or a claim of named approvals. The sibling lane owns seam types.

The owner authorized **Terra** as substitute for the supply and UI review lanes. Terra's supply disposition is suitable for handoff with the documented outstanding manager, history and product work and merged verification still required. Terra's UI disposition is suitable for handoff with the documented interaction semantics, sibling types implementation and merged verification still required. These are Terra's dispositions, not human approvals; named owners retain their ongoing responsibilities.

| Owner | Ongoing responsibility and verification |
| --- | --- |
| @Marwan-Mamdouh (HR, accountable) | Confirm attendance filters, timezone, row DTO and filtered-card mapping; coordinate photo URL resolution in employee API reads and record decisions, reviewer agreement, merged commit and verification. |
| @Hamadaae (supply/integration) | Review per-action roles, envelopes and pagination, including ADMIN/TECHNICIAN IP reads and ADMIN-only supply reports and imports. Review manager validation, historical name resolution, inactive-product safeguards, and the owner-approved four-state guard and ADMIN reactivation contract. |
| @bahaashahin (UI) | Review prop/callback shapes and loading/empty/error/pending states: attendance cards across matching pages, photo `photoUrl`/placeholder and 5 MiB limit, eligible manager choices and reactivation. Confirm no UI-built provider URLs and no direct network responsibilities. |

The [decision register](phase-2-proposed-contracts.md) separates confirmed choices from open gaps. The issue owner explicitly waived staging for **Phase 2 only**: #89 runs local/demo browser acceptance through the real Next rewrite with PostgreSQL, Redis, configured storage and disposable synthetic fixtures. The waiver does not remove #89's scenarios or evidence requirements, apply to later phases, or imply production acceptance or deployment work.

Before closing #67, record the owner-approved decisions and Terra's substitute dispositions, merge the handoff, verify the merged result, and post the exact merged PR/commit, environment, focused test commands/results, and approved limitations. PR #100's previous CI is historical evidence only. Closing #67 does not close the implementation issues or #89.
