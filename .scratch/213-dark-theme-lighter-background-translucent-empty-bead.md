# 213: Dark theme: lighter background and a see-through empty bead

**What to build:** In the dark theme, the page and canvas background gets a bit lighter, and an empty cell (no bead painted) is drawn lighter than today and reads as translucent, so the background shows through it. Per ADR 0021, the design system on claude.ai is the source: change the dark tokens there first, then copy the system into `docs/design/system/` (DESIGN.md §6); don't edit that folder by hand.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Overview / Tour:** asked; not added to either (small polish change).

- [ ] The dark theme's background is visibly a bit lighter, set through role-named tokens
- [ ] An empty cell is lighter than today and looks translucent against the background, on the canvas base layer and in the canvas `PatternTheme`
- [ ] Painted beads, the overlay layer (hover, Selection, Mirror axes, paste preview, Row progress) and text stay clearly readable on the new background
- [ ] The light and high contrast themes are unchanged
- [ ] Light-only exports (PNG, PDF) are unaffected
- [ ] Visual baselines for the dark theme are refreshed from CI
