# 105: Editor draws the Pattern on the renderer

**What to build:** Opening a Pattern shows it drawn by the Pattern renderer on a **Drawing surface**, instead of one DOM element per bead, still with the same rulers, zoom, rotation and scrolling. This is the "expand" step: the new drawing path is added beside the old DOM grid behind a **temporary development switch**, and the DOM grid stays the default until ticket 108. The switch is never a user-facing setting and is deleted in ticket 111 (ADR 0006 retired an earlier flag on the same reasoning: rolling back costs no more than a revert).

The Drawing surface is sized to the visible region and redrawn on scroll and zoom, inside the scroll containers and zoom box the canvas panel already has (ADR 0018). The native horizontal scroll of the canvas panel, the page's own vertical scroll, Space-drag pan, the zoom cluster and the four rulers keep working exactly as now.

This ticket covers looking at a Pattern. Painting and every pointer tool arrive in 106, the overlays in 107.

**Blocked by:** 67 (Pattern renderer)

**Status:** done

- [x] With the switch on, an open Pattern is drawn by the renderer for loom, peyote and brick stitch, with the rulers, zoom, rotation and Space-drag pan behaving exactly as with the DOM grid
- [x] Row progress is drawn: finished rows dimmed, the current row (or, in the column direction, column) outlined, and the marker's look matches the DOM grid's
- [x] Scrolling and zooming redraw only what is in view; drawing cost does not grow with the Pattern's size
- [x] Opening a Pattern paints in about 200 ms at 70×250 on the floor (4× slowdown), and scrolling and zooming stay at 30 fps there; the numbers from ticket 103's performance check are recorded in this ticket
- [x] Screenshots with the switch on match ticket 103's reference screenshots (all fixtures with Row progress, all zooms, rotated) within tolerance
- [x] With the switch off (the default) the app behaves exactly as before
- [x] Tests cover the switch on: viewport selection, zoom, rotation and Row progress, at the domain level or against the renderer

## How it came out

- **The switch** is `?renderer` in the address (`?renderer=dom` turns it off again): `src/devSwitches.ts`, read once by `PatternCanvas.vue`. Off (the default), the component renders exactly what it did; the change is a `v-if` around `PatternGrid`.
- **The surface** (`PatternSurface.vue`) is the box the DOM grid was (its outline and paper, drawn under a CSS scale so a 0.75px border at 25% stays 0.75px) with two canvases in it: the cells (`renderPattern`) and an overlay over them (`renderOverlay`, `src/rendering/overlayRenderer.ts`), which holds the Row progress marker for now and will hold the rest in 106–107. It sits over the space the ruled layout leaves for the grid (`.pattern-canvas__grid-slot`, so the four rulers, the zoom box and the box's size are as they were — tested equal), one ruler gutter in from the box's corner in both orientations, and *outside* the CSS transform that zooms and turns the rulers: a canvas scaled by CSS is a bitmap stretched, and beads must stay crisp, so the renderer applies zoom and rotation itself.
- **Viewport-sized, redrawn on scroll and zoom.** The canvases hold a window of the displayed Pattern: what is on screen (the box cut by every ancestor that clips it, and the window) plus a 160px margin, whole pixels, never past the Pattern. It is redrawn only when the screen leaves the window (scroll and resize are listened for on the window, in capture, once a frame; a little scrolling costs nothing) or when the Pattern, the zoom or its size changes. A test shows a 250×250 and a 400×400 Pattern draw the same number of beads for the same screen; another that a 15,000px Pattern at 300% holds a 1,152×952 canvas. Found and fixed on the way: watching the surface's size by object identity sent the canvases away on every edit; it now watches the numbers.
- **Row progress**: finished rows are the renderer's dimming; the marker is the overlay's, for both directions and every Technique (a row's own rectangle following the shift; loom's column as two sides closed at the ends; peyote's and brick stitch's beads outlined whole, rounded for peyote).
- **Verified in the app with the switch on** (`e2e/visual/renderer-app.spec.ts`, in CI): all 3 Techniques × plain / Row progress rows / columns × 25%, 100%, 300% × upright / rotated (36 comparisons) against ticket 103's DOM references, marker included: the look within the per-Technique budget, and every bead's centre the right color. This also covers the columns direction and its markers, which the stand-in in ticket 67 could not.
- **Tests on the switch-on path** (domain/renderer level): `surfaceWindow.test.ts` (window, margin, clamping, whole pixels, cost independent of size), `overlayRenderer.test.ts` (marker rectangles in both directions, each Technique, shift and packing, transform for zoom and rotation, layer cleared), `PatternSurface.test.ts` (window from the screen and its clipping ancestors, redraw only on leaving the window, zoom and rotation, edit redraw without moving the window, pixel ratio, listeners added and removed, no beads more for a bigger Pattern), `PatternCanvas.test.ts` (default is the DOM grid; switch on gives a surface and no per-bead elements; rulers, transform and box unchanged; layer placement; off by name), `devSwitches.test.ts`.

### Performance (`RENDERER=1 npm run perf`; DOM baseline from ticket 103 in brackets)

| At 4× slowdown | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| open | 133 ms (349) | **183 ms** (946) | 433 ms (3,079) |
| scroll | 49 fps (21) | **53 fps** (7) | 29 fps (2) |
| zoom step | 105 ms (163) | 121 ms (458) | 183 ms (1,497) |

At 6×: open 70×250 = 266 ms (1,455), 250×250 = 649 ms (4,628); scroll 70×250 = 54 fps, 250×250 = 60 fps; zoom step 165 ms and 248 ms. Opening at 70×250 on the floor is about the 200 ms asked for, and scrolling holds well past 30 fps there. Scrolling at 250×250 measures 29 fps at 4× (60 at 6×, so it is partly measurement pace); the window is the whole Pattern at that size's fit zoom, so nothing is redrawn while scrolling, and the remaining cost is per-scroll layout and compositing of the page, not the renderer; it does not grow with the Pattern. Zooming is one step per press here (a redraw of what is on screen), 121–183 ms at these sizes, against 458–1,497 ms. Hover and paint are not measured yet: they need the pointer tools (106).
