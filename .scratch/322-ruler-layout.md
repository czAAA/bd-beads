# 322: One Ruler layout, shared by drawing and picking

**What to build:** The on-screen rulers are laid out several times over from the same maths. `rulerLabels` and `rulerBeads` in `rendering/rulers.ts` each work out the Ruler step with the same lines. `drawRulers` in `rendering/rulerRenderer.ts` returns labels that nobody reads. A press in `ProjectSurface` lays everything out again (`visibleRulerLabels` + `rulerPick`, which calls `rulerBeads` once more). The test helper `rulerNumbers` in `testUtils/beads.ts` builds its own layout with `fontPx: 11`, while phones draw at 12px. Make the Ruler layout one value per view, which the overlay draws from and the press asks what a point selects:

- **Interface.** `rulerLayout(project, surfaceView, { fontPx, numbers })`, where `surfaceView` is 319's Surface view, returns `{ labels, dots, pick(point): Selection | undefined }`:
  - The Ruler step is worked out once per axis per box.
  - The "last number only below `LAST_NUMBER_ONLY_BELOW_ZOOM`" rule and the dot rule (every bead, or every 5th below `DOT_EVERY_BEAD_FROM_PX`) are private to it.
  - `labels` holds the numbers to draw and `dots` the dots to draw. `pick` walks every bead and the labels.
  - `RulerView` is deleted: the viewport, scroll, zoom and rotation come from the Surface view.
  - The module exports `rulerLayout`, the `RulerLabel` / `RulerDot` types and the outset constants that `frameHandles.ts` and `drawFrameEditing` use. `rulerStep`, `rulerLabels`, `rulerBeads`, `rulerDots`, `visibleRulerDots`, `visibleRulerLabels`, `rulerPick` and `labelAt` stop being exported or go away.
- **Callers.**
  - `ProjectSurface` builds the layout in a `computed` from its Surface view and `rulerFontPx()`. It hands the layout to the overlay to draw, and the press calls `layout.pick(point)` instead of laying the rulers out again.
  - `drawRulers` takes the layout and returns nothing.
  - `ProjectSurface` exposes the layout (`defineExpose({ rulerLayout })`) so tests read what was drawn.
- **Test helper.** `rulerNumbers(wrapper)` returns the exposed layout's `labels`, so it no longer builds a layout or copies a font size.
- **Out of scope.** The print rulers (`drawRulers` in `rendering/printPages.ts`) have a fixed step of 5 or 10, no dots and no pick. They stay as they are.

**No behaviour change.** With the Rulers toggle's numbers hidden, a press where a number would be still picks through that number's label, as today. The refactor is pixel-neutral.

**Tests.** Rewrite `rulers.test.ts` against `rulerLayout`, with the step cases tested through it. Add one table test over Technique × rotation × zoom (above and below 50%, and with a bead pitch below 6px) that checks drawing and picking agree:
- the centre of every drawn number picks that number's row or column;
- every drawn dot picks its own bead's line;
- a point midway between two neighbouring dots picks one of the two.

**Docs.** Add a "Ruler layout" entry to CONTEXT.md. Add a line to ADR 0033 saying that drawing and picking read one Ruler layout per view.

Candidate A2 of the architecture review of 2026-10-05.

**Blocked by:** 319 (Surface view).

**Status:** ready-for-agent

- [ ] `rulerLayout(project, surfaceView, { fontPx, numbers })` returns `{ labels, dots, pick }`, with the Ruler step worked out once per axis per box
- [ ] `RulerView` and the per-piece exports are gone; `rulers.ts` exports `rulerLayout`, its types and the outset constants
- [ ] `ProjectSurface` builds the layout once per view; the overlay draws it and the press uses `pick` without laying out again
- [ ] `rulerNumbers` in `testUtils/beads.ts` reads the layout the surface built; no hardcoded `fontPx`
- [ ] A table test over Technique × rotation × zoom checks that every drawn number and dot picks its own line
- [ ] Print rulers are untouched
- [ ] CONTEXT.md has a "Ruler layout" entry; ADR 0033 has the one-layout line
- [ ] The visual check passes with no screenshot changes
- [ ] Typecheck, lint, unit tests and the visual check pass in CI
