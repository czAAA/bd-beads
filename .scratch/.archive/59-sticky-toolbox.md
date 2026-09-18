# 59: Make the Toolbox sticky

**What to build:** The Toolbox (the strip of editing tools above the canvas — Tools, Colors, Edit, Mirror, Row progress) stays pinned near the top of the viewport once scrolled to, so it stays reachable while working on the lower rows of a Pattern taller than the screen.

A tall Pattern grows the canvas panel past the viewport's height. Vertical overflow is never trapped inside the shell — the page itself scrolls, not an inner box (see `.app-shell__canvas`'s own comment in `App.vue`) — so without this, scrolling down to reach a Pattern's lower rows scrolled the Toolbox away too, leaving no way to reach Paint/Fill/Undo/Mirror/Row progress mid-edit.

- `.app-shell__above-canvas` (the Toolbox's wrapper) is `position: sticky; top: 24px`, the offset matching `.app-shell`'s own edge padding so the stuck panel keeps the same breathing room from the browser edge that everything else keeps from the shell's edge.
- Its containing block is a new `.app-shell__canvas-column` wrapper around just the above-canvas and canvas panels, not the whole `.app-shell__right` column — so the Toolbox un-pins once the canvas has scrolled past, rather than staying stuck over the below-canvas section (Beads needed / Saved Patterns / Export and import) too.
- `z-index: 2` on `.app-shell__above-canvas` keeps it painting above `.app-shell__canvas` (a later, `position: relative` sibling per [ADR 0005](../../docs/adr/0005-tools-above-canvas.md)) as that scrolls underneath it.

**Blocked by:** None.

**Status:** done

**Decisions (2026-09-18):**
- **Sticky, not fixed.** Keeps the pin tied to normal document flow with no scroll-tracking script, consistent with the shell's page-level-scroll design — nothing here needed to change how or where the page scrolls.
- **Scoped to a new wrapper, not the whole right-hand column.** `.app-shell__canvas-column` holds only the above-canvas and canvas panels; `.app-shell__right` (which also holds the below-canvas section) would have kept the Toolbox stuck over Beads needed/Saved Patterns/Export while scrolling past them too.
- **top offset echoes the shell's own padding** rather than 0, so the stuck Toolbox doesn't touch the bare browser edge.

- [x] The Toolbox stays visible, pinned near the top of the viewport, while scrolling down a Pattern tall enough that the canvas exceeds the viewport height
- [x] The Toolbox un-pins once the canvas panel has scrolled past, and does not overlap the below-canvas section (Beads needed / Saved Patterns / Export and import)
- [x] The stuck Toolbox paints above the canvas panel scrolling underneath it, not behind it
- [x] Tool group hover-expand (CONTEXT.md's Tool group) still renders unclipped over the canvas while the Toolbox is stuck
- [x] CONTEXT.md's Toolbox entry and ADR 0005 document the sticky behavior
- [x] Full suite green (typecheck, tests, lint)
