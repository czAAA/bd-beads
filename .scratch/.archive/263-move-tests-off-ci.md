# 263: Move the unit and visual tests off CI

**What to build:** Cut GitHub Actions minutes so the free quota covers deployments. CI keeps typecheck and lint only; unit and visual tests run in a pre-push hook; sharding goes.

**Status:** done

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [x] CI runs on pull requests only, with cancel-in-progress concurrency
- [x] A PR that changes only tickets or Markdown skips the checks but still reports "Typecheck and lint"
- [x] Unit and visual jobs, sharding, build artifact and report merge are removed
- [x] `.githooks/pre-push` runs both suites when `src/` or `e2e/` (or their build config) changed, and is enabled by `npm install`
- [x] Deploy ignores pushes that change only tickets or Markdown
- [x] README, CLAUDE.md, ADR 0022 and new ADR 0029 updated
- [ ] Human: branch protection requires only "Typecheck and lint" (remove "Unit tests passed" and "Visual check passed")
