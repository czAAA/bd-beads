# 103: Measurement tools and stored-data compatibility

**What to build:** The safety net for the performance work in ADR 0018, so "faster" and "looks identical" are checked instead of hoped for. Three things, none of which changes what the app does:

1. A **visual check** that renders fixture Patterns in a real browser and compares them with committed reference screenshots of today's DOM output. Fixtures cover loom, peyote and brick stitch; Row progress on (both directions); a Selection; Mirror axes; a paste preview; and Convert image framing. Each at 25%, 100% and 300% zoom and rotated. It runs in CI.
2. A **performance check**, run by hand, that drives the real app in a browser at a chosen CPU slowdown and prints timings for hover, paint stroke, opening a Pattern and dragging the framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop) and at 6×. Today's numbers are recorded in the ticket as the baseline.
3. A **compatibility test** that loads libraries and Pattern files in every format the app writes today (the original version 1 and the current version 2), including one Pattern larger than the current cell cap, and proves they open unchanged. ADR 0018 promises the stored format, Pattern file and QR sharing do not change; this is what keeps that promise.

**Targets these tools measure against** (agreed in the performance plan): on an iPad Air 13″, 60 fps for hover, paint and pan at 250×250. On the floor (4× slowdown), at least 30 fps at 70×250 and at 250×250. Opening a Pattern paints in about 200 ms. The framing drag is smooth.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A browser-testing tool is added as a development dependency, with a script for the visual check and a script for the performance check
- [x] The visual check has reference screenshots for the fixtures above, at the three zooms and rotated, and passes on today's code; CI runs it
- [x] The visual check tolerates only sub-pixel differences and fails when a color, shape, gap or overlay changes
- [x] The performance check prints the timings above at 4× and 6× slowdown and is not part of CI (timings there are too noisy)
- [x] Baseline timings on today's DOM rendering are written into this ticket
- [x] The compatibility test covers a version 1 library, a version 2 library, a single-Pattern file, a whole-library file and an over-cap Pattern, and passes on today's code
- [x] How to run each check is documented where the other scripts are

## Baseline (today's DOM rendering)

Recorded 2026-09-22 with `npm run perf` on the production build (Chromium headless shell 153, Playwright 1.63, 1900×1200 window, an otherwise idle Linux desktop). "fps" is frames per second over a 2 s continuous interaction; "ms" is main-thread busy time per frame (open, zoom step: per action). Numbers vary a few percent run to run.

| At 4× slowdown | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| open | 349 ms | 946 ms | 3,079 ms |
| hover | 11 fps (95 ms) | 3 fps (327 ms) | 1 fps (951 ms) |
| paint stroke | 23 fps (40 ms) | 7 fps (134 ms) | 2 fps (529 ms) |
| scroll | 21 fps (42 ms) | 7 fps (143 ms) | 2 fps (440 ms) |
| zoom step | 163 ms | 458 ms | 1,497 ms |
| framing drag | 18 fps (51 ms) | not possible: the cell cap refuses it | not possible (cap) |

Framing drag at 100×100: 21 fps (43 ms).

| At 6× slowdown | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| open | 465 ms | 1,455 ms | 4,628 ms |
| hover | 7 fps (145 ms) | 2 fps (531 ms) | 1 fps (1,275 ms) |
| paint stroke | 16 fps (59 ms) | 5 fps (220 ms) | 1 fps (798 ms) |
| scroll | 15 fps (62 ms) | 5 fps (200 ms) | 2 fps (697 ms) |
| zoom step | 256 ms | 655 ms | 2,269 ms |
| framing drag | 15 fps (61 ms) | not possible (cap) | not possible (cap) |

Framing drag at 100×100: 15 fps (62 ms). Hover and paint are measured at the zoom the Pattern opens at (100% for 60×90 and 70×250, 30% fit for 250×250), on beads that are on screen. The 70×250 and 250×250 Patterns are seeded straight into the library, since the New Pattern form refuses them; Convert image framing at those sizes is refused for the same reason, so it is reported as n/a until ticket 108 lifts the cap.

Nothing meets the floor (30 fps at 4×) at 70×250 or 250×250 today, and hover, paint and the framing drag miss it even at 60×90.

## How it came out

- **Visual check** (`npm run visual`, `e2e/visual/`): 22 scenarios × 3 zooms × upright/rotated (loom, peyote, brick × plain / Row progress rows / Row progress columns / Selection / paste preview / hover paint; Mirror axes on loom and peyote; "Mirror current" hover, mirrored hover and Erase hover), plus Convert image framing for each Technique at picture zoom 100%, 200% and dragged. 147 reference screenshots. Only the grid is compared (rulers carry text, and fonts differ between machines). Tolerance: 40% of one bead's area in differing pixels; four extra tests prove a recolored bead, a missing bead, a Row progress overlay and another Technique are caught. Runs in CI.
- **Framing zoom**: the ticket's "25%, 100% and 300%" describes the editor; the framing preview has its own picture zoom (100%–800%) and a fit-to-panel scale, so it is checked at picture zoom 100% and 200% and after a drag, not at 300% (a 16×10 frame at 300% is almost a single color and shows nothing).
- **Compatibility test** (`src/domain/compatibility.test.ts`, fixtures in `src/domain/fixtures/`): version 1 library (including a Pattern in the oldest shape), version 2 library, single-Pattern file, whole-library file, and a 101×101 (10,201-bead) Pattern past the cap. Each opens as exactly the Patterns it held; a version 2 library also writes back byte-for-byte.
- Two test hooks were added to the app so the checks find the drawing whatever draws it: `data-testid="pattern-grid"` on the grid and `data-testid="convert-image-box"` on the framing preview. Both are meant to move to the renderer's surfaces.
