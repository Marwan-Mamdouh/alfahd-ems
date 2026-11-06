# PR #50 supply follow-up acceptance evidence

Evidence below is for the **uncommitted** follow-up worktree based on `b7aaef5`. It is not evidence that PR #50 currently contains these changes. PostgreSQL 16 and Redis 7 were isolated Compose services on localhost ports 55457 and 56380; fixtures were synthetic.

| Issue | Evidence and remaining limitations |
| --- | --- |
| #51 | PostgreSQL tests cover receipts with initially absent and existing stock, competing assignments, a late injected receipt failure, and caller-owned rollback for create, assign, return and condition changes. Not every allowed lifecycle transition has its own injected-failure test. |
| #52 | PostgreSQL covers competing serviceable/damaged opening registrations, each opening condition, serial retries, audited reconciliation and registration against already-serialized stock. |
| #53 | PostgreSQL covers A-to-B usable movement, external repair, serviceability restoration, competing restoration and rollback. |
| #54 | Redis/PostgreSQL covers 1,001 rows, duplicates, persisted safe errors and interrupted retries; full Nest/JWT import and polling are exercised. Issue was closed by user request; changes are not yet pushed. |
| #55 | Direct PostgreSQL IPv4 host and uniqueness checks passed. Linux empty migration replay and a synthetic pre-0006 fixture containing users, active/inactive warehouses, stock, movements, routers, custody, condition history and reserved/archived IP history passed. Fixtures and assertions: `apps/api/test/fixtures/pre-0006-representative.sql` and `post-migration-verify.sql`. This synthetic fixture is not a copy of production data. |
| #56 | PostgreSQL proves both ordering cases for first receipt versus generic adjustment, plus caller rollback and blocked inbound, outbound, return and transfer operations while first receipt holds the product lock. |
| #57 | PostgreSQL tests force both lock orderings for receipt, return and condition placement versus deactivation. Separate checks cover positive stock, assigned technician and physically located damaged router blockers. |
| #58 | The M2b installation gate is intentionally retained: PostgreSQL tests verify rejection preserves technician custody. M3a customer handoff is deferred and has not been verified. |
| #59 | PostgreSQL checks missing/blank reasons, forbidden transitions, persisted valid reason/actor/time and rollback on injected status-audit failure. |
| #60 | PostgreSQL checks competing reserve, release, archive/reserve and unarchive operations. Not every retry/archive combination is independently tested. |
| #61 | PostgreSQL checks audit-insertion rollback, old/new notes, actor/time and no-op edits. |
| #62 | Real Redis report worker and local report storage produce readable mixed and empty warehouse workbooks. A full Nest test validates JWT access and downloads through the real Next.js `/api/*` rewrite. Cloudinary itself is not verified; local storage is the configured fallback. |

## Commands and results

From the repository root, after migrating the disposable database:

```powershell
pnpm --filter @alfahd/types build
pnpm typecheck
pnpm lint
$env:API_URL='http://127.0.0.1:3000'; pnpm build
pnpm test
pnpm --filter @alfahd/api test:e2e
$env:INVENTORY_TEST_DATABASE_URL='postgresql://acceptance:acceptance_only@127.0.0.1:55457/acceptance'
$env:IMPORT_TEST_REDIS_URL='redis://127.0.0.1:56380'
pnpm --filter @alfahd/api exec vitest run test/inventory-classification.pg.spec.ts test/ip-import.redis.pg.spec.ts test/full-stack-acceptance.pg.spec.ts
```

The type build, typecheck, lint, and build passed on Windows and a WSL Ubuntu copy (Node 24.21.0, pnpm 12.6.0). On Linux the standard test run passed 361 tests with the opt-in infrastructure tests skipped; mocked e2e passed 189 (the existing e2e run emitted ioredis shutdown warnings). The explicitly enabled infrastructure suites passed 45 tests on Linux, including `0700` directory and `0600` file assertions on the native Linux filesystem. The Next.js proxy test uses the actual dashboard development server, the real JWT guard, and local report storage. Existing directories and deployment-specific ACLs remain operator responsibilities.

The follow-up needs commit/integration, final review and GitHub CI on the actual PR head. Do not infer full issue acceptance from the scenarios above where limitations are stated.
