# Claude

This file documents how Claude Code and agent skills are configured for this repo.

## Agent skills

### Issue tracker

Issues are tracked as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `done`. See `docs/agents/triage-labels.md`.

### Pull requests

Headline format `type:[ticketNumber] Description`, with type `feat`, `fix` or `ref`. See `docs/agents/pull-requests.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root, plus `docs/adr/` for architecture decision records. See `docs/agents/domain.md`.

### Design

All UI work follows the bd-beads design system (version 14), copied into `docs/design/system/`. `DESIGN.md` at the repo root is its entry point: the rule for which source wins, a map of where each topic lives, and the app-specific notes (the canvas `PatternTheme`, light-only exports, bundled fonts). The design system wins for tokens, component specs, copy and artwork; `DESIGN.md` wins only for its app-specific notes. Use the role-named tokens from `docs/design/system/tokens.json`; don't hardcode colors, fonts, sizes or shadows. If a UI need isn't covered, add it to the design system on claude.ai first, then copy it in (`DESIGN.md` §6); don't edit `docs/design/system/` by hand. Take icons, logo and favicon files from `docs/design/system/`; don't redraw them. The decision to follow the design system is ADR 0021.

### Overview and Tour

Whenever you add or change user-facing functionality (writing a ticket or building one), ask the user whether it should be added to the Overview (ticket 77) and to the Tour (ticket 80), and record the answer in the ticket. Don't add it to either without asking.

## Context hygiene
- Search with grep/glob before reading; read with offset/limit, not whole large files.
- Don't re-read files already in context unless they changed.
- Pipe verbose command output (tests, builds, logs, installs) through tail -n 50 or grep.
- Never cat lock files, generated files, minified bundles, or large logs.
- Screenshots and visual-test artifacts (`test-results/`, `e2e/visual/__screenshots__/`) are images: each one read into context stays there for the rest of the session. Trust Playwright's text reporter (pass/fail, pixel-diff count) first; only `Read` an image when a diff genuinely needs visual judgment. Crop to the region under review before reading rather than reading a full-page screenshot. When a visual test fails, read the `diff.png` before reaching for `actual.png`/`expected.png` too.
