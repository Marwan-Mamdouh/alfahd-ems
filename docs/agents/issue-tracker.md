# Issue tracker: GitHub

Issues live in Marwan-Mamdouh/alfahd-ems. Use the gh CLI.

## Conventions

- Verify the target with `gh repo view --json nameWithOwner`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
- Create: `gh issue create --repo Marwan-Mamdouh/alfahd-ems --title "..." --body-file <path>`.
  Use a UTF-8 file for multiline bodies.
- Comment: `gh issue comment <number> --body-file <path>`.
- Labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: post an explanation with `gh issue comment`, then `gh issue close`.
- Prefer native GitHub sub-issues and blocking dependencies when supported by
  the installed CLI/API. Otherwise use `Part of #<parent>` and
  `Blocked by: #<number>` in the issue body, with a task list on the parent.
- File issues only in this repository.

## Pull requests as a triage surface

PRs as a request surface: no.

GitHub shares issue and PR numbers. For an ambiguous reference, try
`gh pr view <number>` and fall back to `gh issue view <number>`.

## Skill operations

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means read the GitHub issue, including comments.
