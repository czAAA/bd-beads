# Claude

This file documents how Claude Code and agent skills are configured for this repo.

## Agent skills

### Issue tracker

Issues are tracked as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `done`. See `docs/agents/triage-labels.md`.

### Pull requests

Headline format `type:[ticketNumber] Description`, with type `feat`, `fix` or `ref`. See `docs/agents/pull-requests.md`.

### Implementing tickets

Standing orders for every implementation (incl. `implement` skill); don't ask between steps:
1. Update local main `origin/main` first.
2. create a worktree at `../bd-beads-<ticket>/` (a sibling of the repo, never inside it) from fresh main and work there
3. Archive the ticket in the same change.
4. When finish: /code-review, commit, push, open PR.
5. explicitly say whats left for a human

### Coding standards

Before writing or reviewing code, read `CODING_STANDARDS.md`: where code goes, the rules every change keeps, and what lint and tests already enforce. Writing tests: `docs/testing.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root, plus `docs/adr/` for architecture decision records. See `docs/agents/domain.md`.

### Design

All UI work follows the bd-beads design system (baseline v18, owned by this repo since ADR 0030), in `docs/design/system/`. `DESIGN.md` at the repo root is its entry point: the rule for which source wins, a map of where each topic lives, and the app-specific notes (the canvas `ProjectTheme`, light-only exports, bundled fonts). The design system wins for tokens, component specs, copy and artwork; `DESIGN.md` wins only for its app-specific notes. Use the role-named tokens from `docs/design/system/tokens.json`; don't hardcode colors, fonts, sizes or shadows. If a UI need isn't covered, or the app deliberately differs from a card, change the design system in place in the same commit (`DESIGN.md` §6): the card's `README.md`, tokens, `bundle.css` and `src/styles/design-values.css`, plus a line in the README's Version changelog. The repo is the source: don't sync from claude.ai into it. Only if the claude.ai copy needs to know a change, copy it back out from the repo, one way. Take icons, logo and favicon files from `docs/design/system/`; don't redraw them. The decision to follow the design system is ADR 0021; ADR 0030 makes the repo its owner.

### Tour

The Tour (ticket 80) is switched off (`TOUR_ENABLED` in `src/features.ts`, ticket 247), so don't ask about it.

## Context hygiene
- Search with grep/glob before reading; read with offset/limit, not whole large files.
- Don't re-read files already in context unless they changed.
- Pipe verbose command output (tests, builds, logs, installs) through tail -n 50 or grep.
- Never cat lock files, generated files, minified bundles, or large logs.
- Screenshots and visual-test artifacts (`test-results/`, `e2e/visual/__screenshots__/`) are images: each one read into context stays there for the rest of the session. Trust Playwright's text reporter (pass/fail, pixel-diff count) first; only `Read` an image when a diff genuinely needs visual judgment. Crop to the region under review before reading rather than reading a full-page screenshot. When a visual test fails, read the `diff.png` before reaching for `actual.png`/`expected.png` too.
