# 272: Restore CI on pull requests and remove the pre-push hook

**What to build:** With the repository public, GitHub Actions minutes cost nothing, so every pull request is checked on GitHub again (typecheck, lint, unit tests, visual check), and the pre-push hook from ticket 263 is removed. GitHub becomes the proof that a change passed, not a habit on the developer's machine.

**Blocked by:** 271 (the repository must be public first, or the restored CI spends the private quota).

**Status:** ready-for-agent

- [ ] A CI workflow runs typecheck, lint, the unit tests and the visual check on every pull request to `main`, and skips PRs that only change tickets or Markdown; sharding is back if it shortens wall time (minutes are free now), ending in one aggregate check per suite so branch protection has stable names
- [ ] The CI workflow uses `pull_request` (never `pull_request_target`), has a read-only token, uses no secrets, and pins third-party actions to commit SHAs
- [ ] Visual failures upload their report as an artifact, as before ADR 0029
- [ ] The pre-push hook and whatever enables it on `npm install` are removed
- [ ] A new ADR supersedes ADR 0029; the README and `CLAUDE.md` (the context-hygiene note on the hook and `--no-verify`) describe CI as the gate. Keep the rule against running the full suite by hand on this machine
- [ ] Human: branch protection on `main` requires the restored aggregate checks
