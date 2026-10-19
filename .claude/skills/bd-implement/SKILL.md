---
name: bd-implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /bd-tdd where possible, at pre-agreed seams.

Run typechecking regularly and single test files regularly. At the end run `npm run check` and `npm run test:related -- <changed files>`; then `npm run test:full` before opening the PR (it skips itself on a slow machine, where the full suite is CI's).

Once done, use /bd-review to review the work.

After the PR is open, run `gh pr checks <number> --watch --fail-fast` in the background and report its result in your final message. If it fails, read it with `bash scripts/ci-failures.sh <number>`, fix, push and watch again; don't end on "CI not seen yet". If you update visual baselines, read the changed images first (`docs/testing.md`, Visual baselines).

Commit your work to the ticket's branch, in its worktree (`CLAUDE.md`, Implementing tickets), never on `main`.

End your final message with a `Skills used:` line listing every skill you invoked during the implementation (e.g. `bd-tdd`, `bd-review`), or `none`.
