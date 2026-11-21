# Orchestrator learnings

- 2026-11-21: Fresh API test worktrees need the tracked `.env.example` copied locally as in CI; never copy real secrets. Build types first and avoid concurrent full unit/e2e runs on this Windows host.
- 2026-11-21: The standard production build may stop once to surface a Next.js upgrade notice; a normal retry can pass with the advisory still active. Keep the dependency upgrade distinct from the patch.
