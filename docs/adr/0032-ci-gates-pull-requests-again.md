# CI gates pull requests again

**Status: accepted.** Ticket 272. Supersedes ADR 0029.

## Context

ADR 0029 moved the tests off GitHub because the private repository's Actions minutes ran out. The repository is public now (ticket 271, ADR 0031), and Actions minutes on a public repository cost nothing. The pre-push hook that replaced CI proves nothing on GitHub and `--no-verify` bypasses it.

## Decision

- `ci.yml` runs on every pull request to `main`: typecheck and lint, the unit tests (3 Vitest shards), and the visual check (4 Playwright shards over one shared build). It skips PRs that change only `.scratch/` or Markdown.
- Each suite ends in one aggregate job with a stable name: "Typecheck and lint", "Unit tests passed", "Visual check passed". Branch protection requires those three; the shard counts can change without touching it.
- The workflow uses `pull_request` (never `pull_request_target`), a read-only `contents` token and no secrets, and pins every action to a commit SHA (the comment names the version).
- A failed visual shard uploads its `test-results`, and every shard's blob report is merged into one HTML report artifact.
- The `.githooks/pre-push` hook and the `prepare` script that enabled it are removed.
- The rule against running the full suite by hand on the dev machine stays: it can exhaust its memory. Run related tests while working and let CI run the rest.

## Consequences

- GitHub is the proof a change passed; nothing depends on a habit on one machine.
- A required check does not report on a PR skipped by `paths-ignore`, so a Markdown-only or ticket-only PR waits on checks that never start. Merge those with an admin override, or add a small always-running gate later.
- The visual references are made on Linux, as CI is. The Deploy workflow is unchanged and still builds on `main`.
