# Orchestrator learnings

- 2026-11-21: Fresh API test worktrees need the tracked `.env.example` copied locally as in CI; never copy real secrets. Build types first and avoid concurrent full unit/e2e runs on this Windows host.
- 2026-11-21: The standard production build may stop once to surface a Next.js upgrade notice; a normal retry can pass with the advisory still active. Keep the dependency upgrade distinct from the patch.
- 2026-11-23: Windows ledger commit hooks can exceed 120 seconds; allow 600 seconds. A cancelled commit can leave an index lock; confirm no Git process owns it before removing that run's stale lock.
- 2026-11-23: Use a detached snapshot of the actual remote squash SHA for acceptance; compare product trees with the reviewed delivery. Probe `pg_isready` before migrating disposable Docker PostgreSQL.
- 2026-11-23: Review live generated `/-json`; Nest reflection can misdescribe a nullable union or omit inferred pagination types. Explicit Swagger annotations plus an API-generated-document regression avoid static snapshot false confidence.
- 2026-11-23: Move Windows child sessions away from worktrees before removal; use per-command `git -c core.longpaths=true worktree remove` for deep dependency trees.
- 2026-11-24: Accept opt-in PostgreSQL/Redis checks only with captured execution, explicit isolated URLs and pass/skip counts; a report that omits or contradicts that evidence is not a pass. Dynamic loopback Docker ports avoid disrupting project containers.
- 2026-11-24: A Windows Vite startup error naming a missing `dist/client/client.mjs` was fixed by a frozen force reinstall; it fetches many foreign-platform packages, so reserve it for a confirmed broken install.
