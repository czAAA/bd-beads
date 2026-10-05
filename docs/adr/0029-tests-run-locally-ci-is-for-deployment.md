# Tests run locally; GitHub Actions is for deployment

**Status: superseded by ADR 0032.** Ticket 263. Supersedes the sharded CI of tickets 255–257.

## Context

The repository is private, so Actions runs on the free plan's 2,000 minutes a month, with every budget set to $0 and "stop usage" on. Sharding the unit and visual tests (255–257) cut wall time but raised billed minutes: each job is billed separately, rounded up, and repeats checkout and `npm ci`. 1,800 of the 2,000 minutes were gone with the cycle still open.

## Decision

- `ci.yml` is deleted. No workflow runs on pull requests; GitHub Actions only deploys.
- `.githooks/pre-push` runs typecheck, lint, the unit tests and the visual check in full when a push touches `src/`, `e2e/` or what builds them; `npm install` enables it through `core.hooksPath`.
- The deploy build still runs `vue-tsc -b` (the `build` script), so a type error cannot ship.
- The deploy workflow ignores pushes that change only `.scratch/` or Markdown.
- No sharding, aggregate jobs or report merging remain.

## Consequences

- Nothing on GitHub proves the tests passed; the hook is a habit enforced on the developer's machine, and `--no-verify` bypasses it. The PR says so when it does.
- Branch protection must require no status checks: "Typecheck and lint", "Unit tests passed" and "Visual check passed" no longer exist and would block every merge.
- The visual references are made and checked on Linux; the hook runs on whichever machine pushes.
