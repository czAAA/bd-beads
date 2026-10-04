# Tests run locally; GitHub Actions is for deployment

**Status: accepted.** Ticket 263. Supersedes the sharded CI of tickets 255–257.

## Context

The repository is private, so Actions runs on the free plan's 2,000 minutes a month, with every budget set to $0 and "stop usage" on. Sharding the unit and visual tests (255–257) cut wall time but raised billed minutes: each job is billed separately, rounded up, and repeats checkout and `npm ci`. 1,800 of the 2,000 minutes were gone with the cycle still open.

## Decision

- CI is one job, "Typecheck and lint", on pull requests only. A newer push to a PR cancels its older run. A PR that changes only `.scratch/` or Markdown skips the steps but still reports the check, since a workflow-level `paths-ignore` would leave a required check pending forever.
- The unit and visual tests no longer run in CI. `.githooks/pre-push` runs both in full when a push touches `src/`, `e2e/` or what builds them; `npm install` enables it through `core.hooksPath`.
- The deploy workflow ignores pushes that change only `.scratch/` or Markdown.
- No sharding, aggregate jobs or report merging remain.

## Consequences

- Nothing on GitHub proves the tests passed; the hook is a habit enforced on the developer's machine, and `--no-verify` bypasses it. The PR says so when it does.
- Branch protection must require only "Typecheck and lint"; "Unit tests passed" and "Visual check passed" no longer exist and would block every merge.
- The visual references are made and checked on Linux; the hook runs on whichever machine pushes.
