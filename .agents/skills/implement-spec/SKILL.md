---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**. Resolve tickets only with explicit user authorization.

Obtain explicit user authorization before committing, pushing, opening or changing a PR (including marking it ready), closing issues, or destructively cleaning up worktrees. Never discard uncommitted or untracked work without explicit authorization. If authorization is absent, leave the work available for review and report the remaining steps.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Start every subagent with a fresh context window.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch. If explicitly authorized to open a PR, open a draft after the first integration in step 5 (a branch with no commits ahead of main can't open one). Only include closing references when issue closure is explicitly authorized.

4. Use a fresh **implementer subagent** for each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting; if not, preserve existing work and rebase onto it, resolving conflicts;
   - calls the Skill tool with `tdd` to build the ticket;
   - rebases onto the current integration branch tip before reporting done

5. Once an **implementer subagent** completes, integrate its rebased branch into the integration branch with a **merger subagent** using a fast-forward-only merge (`git merge --ff-only`). If the integration branch has advanced, rebase the implementer branch again first. Do not create merge commits.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single fresh **implementer subagent**.

8. Only if explicitly authorized, mark a draft PR ready or resolve tickets through the issue tracker. Otherwise report the integration branch and pending actions.

9. Clean up worktrees only when safe and authorized; obtain explicit authorization before any cleanup that would discard changes or untracked files. Preserve work otherwise.
