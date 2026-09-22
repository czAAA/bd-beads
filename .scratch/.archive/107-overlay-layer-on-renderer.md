# 107: Overlay layer on the renderer

**What to build:** With the temporary switch on (ticket 105), everything that comes and goes with the pointer or a tool is drawn on the Drawing surface's overlay layer, so it never forces the cells to be redrawn: the Select tool's marquee and its highlight over the selected beads, the paste preview under the cursor, Mirror's axis lines, and the dimmed beads shown while hovering a "Mirror current" button. Together with 106 this brings the renderer path to full parity with the DOM grid; after this nothing the DOM grid does is missing.

The marquee stays one outlined rectangle even across peyote's shifted rows, the axis lines follow the Pattern as it is rotated, and each overlay looks like it does today.

**Blocked by:** 106 (Pointer interaction and hover preview on the renderer)

**Status:** done

- [x] The Selection is drawn as today: a highlight over its beads and an outline that reads as one rectangle on loom, peyote and brick stitch
- [x] The paste preview draws the copied block under the cursor in its real colors, honouring Mirror as today
- [x] Mirror axis lines are drawn whenever a direction's count is above 0, in the right place at every zoom, and follow rotation
- [x] Hovering a "Mirror current" button dims exactly the beads clicking it would overwrite, and nothing else
- [x] Changing an overlay repaints only the overlay layer, not the cells; a Selection drag and a paste hover hold the floor target (at least 30 fps at 4× CPU slowdown) at 70×250 and 250×250, with the numbers recorded in this ticket
- [x] Screenshots with the switch on match ticket 103's reference screenshots for Selection, paste preview and Mirror axes within tolerance
- [x] Each overlay has a test on the renderer path; no behaviour is left covered only by a DOM-grid test

## How it came out

With ticket 106 the surface's overlay layer already held the hover preview (and so the paste preview, which reaches it as `previewCells` in each bead's own colors, mirrored as the app builds them) and the Row progress marker. This adds the rest, in `renderOverlay`, so the renderer path now does everything the DOM grid did:

- **The Selection**: a 30% wash over each selected bead's inside (the rim stays as it is, as the DOM's background-under-border did), as rectangles on loom and brick stitch and as a bitmap blit on peyote (a big Selection is thousands of beads and is redrawn as it is dragged), plus a 2px outline on the beads at the rectangle's edge, bead by bead so it reads as one rectangle across the shifted rows of peyote and brick stitch, clipped to peyote's rounded inside as an inset shadow was. Only the beads on screen are drawn, however big the Selection is.
- **Mirror's axis lines**: a 2px line at 65% for each axis of each direction, across the whole Pattern in its own space (so peyote's half-bead of width and packed height are counted, and rotation turns them with it), drawn above everything else as before.
- **"Mirror current" dimming**: the beads a hovered button would overwrite are drawn faded over the paper as opaque pieces already blended with it (`BeadShape.backdrop`, `fadeOver`), which covers the bead under them on the cells layer without touching it, blitted as bitmaps. Stacked as the DOM stacked them: faded beads, Selection, hover preview, Row progress marker, axes.
- **`PatternSurface`/`PatternCanvas`** pass `selection`, `mirrorAxisCounts` and `dimmedCells` through; an overlay change draws the overlay only (tested: the cells are not drawn again).
- The bitmap cache was pulled out of the bead look into `src/rendering/sprites.ts`, now shared with the overlay.
- Found by comparing against the DOM references, and fixed: `fadeOver` could not read the `rgb(...)` strings `greyscale` makes, so a faded bead came out unfaded (dark grey). The tests that compared against `fadeOver` itself passed regardless; they now pin the arithmetic (#e63746 faded over white is `rgb(198, 198, 198)`).
- **Verified in a real browser with the switch on** (`e2e/visual/renderer-overlays.spec.ts`, in CI): the existing visual scenarios, run unchanged through the app on the surface against the DOM references, at 25%/100%/300% upright and rotated (20 comparisons): the Selection on each Technique (3), the paste preview on each Technique with its Selection (3), Mirror axes on loom and peyote (2), "Mirror current" hover (1), and the mirrored hover preview (1). Beads that an overlay is drawn over are excluded from the bead-color check (named in `scenarios.ts`, next to the scenario that covers them). Together with tickets 105 and 106 every scenario the DOM check has (66 of them, plus framing) now has a counterpart on the renderer path.
- **Unit tests** on the renderer path: each overlay in `overlayRenderer.test.ts` (the wash and outline for a Selection on loom, brick stitch and peyote, culled to the screen, clipped to the Pattern; axes for each direction, peyote's measure, none when no axis; faded beads in their own colors, culled, empty ones; stacking order), `PatternSurface.test.ts` (each overlay reaching the overlay layer alone), `PatternCanvas.test.ts` (props and the six pointer events passing through), and `beadLook`'s faded beads over a backdrop.

### Performance (`RENDERER=1 npm run perf`, loom Patterns)

| | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| Selection drag, 4× | 60 fps (6 ms) | **60 fps** (7 ms) | **60 fps** (7 ms) |
| paste hover, 4× | 60 fps (5 ms) | **60 fps** (5 ms) | **60 fps** (6 ms) |
| Selection drag, 6× | 60 fps (8 ms) | 60 fps (10 ms) | 60 fps (11 ms) |
| paste hover, 6× | 60 fps (7 ms) | 60 fps (8 ms) | 60 fps (9 ms) |

The floor (30 fps at 4×) is held with room to spare: an overlay change is one clear and the beads it touches, never the cells. The perf check gained "select drag" and "paste hover" (`PERF_ONLY=select,paste`).
