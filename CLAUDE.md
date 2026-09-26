# Claude

This file documents how Claude Code and agent skills are configured for this repo.

## Agent skills

### Issue tracker

Issues are tracked as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `done`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root, plus `docs/adr/` for architecture decision records. See `docs/agents/domain.md`.

### Design

All UI work follows `DESIGN.md` at the repo root: tokens, light and dark themes, layout, component templates and bead drawing. The approved reference screenshots are `docs/design/light.png` and `docs/design/dark.png`, and the decision is ADR 0021. Use its role-named tokens; don't hardcode colors, fonts, sizes or shadows. If a UI need isn't covered, extend `DESIGN.md` first (mark it **Derived**), then build it. The logo, favicon and icon SVGs, `tokens.json` and static component previews are in `docs/design/system/` (`DESIGN.md` §10). Take icons and logo files from there; don't redraw them.
