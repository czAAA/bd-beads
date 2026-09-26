# 140: Bead drawing: board, per-theme colors, faded finished rows

**What to build:** The Pattern is drawn as `DESIGN.md` §7 describes: beads on a rounded `--board`, a 2px gap, rounded beads with 22% corners, a faint rim in light and none in dark, finished Rows faded toward the board in light (28% color over 72% board) and greyed at 45% in dark, a 2px current-row outline in `--marker`, and rulers in DM Mono with the current row's number in bold `--marker`. The Pattern renderer keeps its structure (ADR 0018): only `PatternTheme` and the bead drawer change. PNG and PDF exports always use the light theme.

**Blocked by:** 136

**Status:** ready-for-agent

**Design system v13:** `interaction-and-motion.md` adds the on-Pattern states: a hovered bead shows the 2px `bead-outline` or, with Paint and a color, that color at 60%; the cursor is a crosshair over the board, grab while Space is held, grabbing while panning. The component card(s) in `docs/design/system/components/` are the spec: BeadBoard, BeadHover.

- [ ] `PatternTheme` has a light and a dark value set with every field in the §7 table (`background`, `rim`, `emptyBead`, `seam`, `marker`, `outline`) and the renderer follows the active theme
- [ ] Switching theme redraws the Pattern in the new colors without changing its size or scroll position
- [ ] Every Technique and Form factor still draws correctly with the new look (loom, peyote, brick stitch seam)
- [ ] PNG and PDF exports and the Convert image preview use the light `PatternTheme` regardless of the app's theme
- [ ] The renderer's reference images (ADR 0018) are redrawn for the new look and the renderer, hit-test and export tests pass
- [ ] Ticket 103's performance check still meets its frame-rate targets
- [ ] Hover preview and cursors follow `interaction-and-motion.md` and the BeadHover card
