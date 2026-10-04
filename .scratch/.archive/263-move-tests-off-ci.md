# 263: Move the unit and visual tests off CI

**What to build:** Cut GitHub Actions minutes so the free quota covers deployments. CI runs nothing on pull requests; typecheck, lint, unit and visual tests run in a pre-push hook; sharding goes.

**Status:** done

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [x] `ci.yml` is deleted: no workflow runs on pull requests
- [x] `.githooks/pre-push` runs typecheck, lint and both suites when `src/` or `e2e/` (or their build config) changed, and is enabled by `npm install`
- [x] Deploy ignores pushes that change only tickets or Markdown
- [x] README, CLAUDE.md, ADR 0022 and new ADR 0029 updated
- [ ] Human: branch protection requires no status checks (remove "Typecheck and lint", "Unit tests passed" and "Visual check passed")
