---
name: bd-implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

If the arguments start with `-bulk` (`/bd-implement -bulk 0692-0695`), this is a batch: follow `.claude/skills/bd-implement-bulk/SKILL.md` with the rest of the arguments, and nothing below applies to you directly (it is what each ticket's sub-agent follows).

Use /bd-tdd where possible, at pre-agreed seams.

Run typechecking regularly and single test files regularly. At the end run `npm run check` and `npm run test:related -- <changed files>`; then `npm run test:full` before opening the PR (it skips itself on a slow machine, where the full suite is CI's).

Once done, use /bd-review to review the work.

If you update visual baselines, read the changed images first (`docs/testing.md`, Visual baselines).

Once the PR is open, you are done: don't watch its CI. No `gh pr checks --watch`, no subscribing to the PR's activity, no scheduled check-ins, no PR comments about CI. The user watches CI and comes back to you if it fails (then read it with `bash scripts/ci-failures.sh <number>`, fix and push). Watching CI is only for a bulk run, which merges its PRs in order once they are green (`bd-implement-bulk`).

Commit your work to the ticket's branch, in its worktree (`CLAUDE.md`, Implementing tickets), never on `main`.

End your final message with a `Skills used:` line listing every skill you invoked during the implementation (e.g. `bd-tdd`, `bd-review`), or `none`.
