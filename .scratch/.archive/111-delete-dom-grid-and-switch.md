# 111: Delete the DOM grid and the temporary switch

**What to build:** The "contract" step: with every batch of tests migrated (109, 110), the one-element-per-bead grid and the temporary development switch that chose between it and the renderer are deleted. After this the Pattern is drawn one way only, by the Pattern renderer, and there is no path that renders a Pattern as DOM elements.

**Blocked by:** 109 (Migrate the App-level tests off DOM cells), 110 (Migrate the remaining suites off DOM cells)

**Status:** done

- [x] The DOM grid's cell rendering and the temporary switch are removed, along with the styles and test identifiers that existed only for them
- [x] No reference to the removed elements remains in the source or the tests
- [x] The whole suite is green, including ticket 103's visual check against the reference screenshots and its compatibility test
- [x] The performance check is re-run and the final numbers are recorded in this ticket: on the floor (4× CPU slowdown) at least 30 fps for hover and paint at 70×250 and 250×250
- [x] CONTEXT.md and ADR 0018 still describe what the code does

## How it came out

- **Deleted:** `PatternGrid.vue` (its rows and cells, its styles: the wedgewood marker, the dimming, the selection wash and outline, the preview, the axis lines, the peyote radius and brick seam), the temporary switch (`src/devSwitches.ts` and its test) and the `v-if` in `PatternCanvas.vue` that chose between them, the `?renderer=dom` option and `GRID` variable of the browser checks, and the test identifiers that existed only for the old grid (`grid-row`, `grid-cell`, `cell-preview`, `mirror-axis-line-*`; `convert-image-row` and `-bead` went with ticket 104). The surface's own test id `pattern-grid` was renamed `pattern-surface` so it no longer reads as the old grid's. `grep` for `PatternGrid`, the switch, `renderer=dom` and each removed identifier finds nothing in `src`, `e2e`, the README or the config (`docs/adr/0013` still names PatternGrid.vue as a file that was fixed once, which is history).
- **The visual check** is the one ticket 103 built, now checking the only drawing there is: the strict per-pixel comparison of the DOM grid (`visual.spec.ts`, which needed the DOM to run) and the stand-in harness that drew the renderer beside it (`e2e/harness/`, `renderer.spec.ts`) are gone, and the reference screenshots made from the old grid are what `look.spec.ts`, `overlays.spec.ts`, `interaction.spec.ts` and `framing.spec.ts` hold the app to, each scenario of the old check (all 22) at every zoom, upright and rotated (README says how the two comparisons work). It tests itself: a bead recolored or left empty and a marker the reference lacks must fail (`look.spec.ts`). Ticket 103's compatibility test passes. CI runs it all.
- **Green:** typecheck, lint, 1,382 unit tests, 75 browser tests (the DOM-only strict ones are what went), the compatibility test.
- **CONTEXT.md and ADR 0018 still describe the code**: the Pattern renderer, the Drawing surface (a base layer for the cells, an overlay for everything that comes and goes with the pointer), viewport-sized and redrawn on scroll and zoom, the look unchanged, the framing preview reusing the palette while dragging; the one line of ADR 0018 that said what the tests would do now says what they do.
- **Found on the way, not part of this ticket:** brick stitch's rulers and the box around the Pattern still use a 20px row where 21px is drawn (and always were drawn): ticket 121.

### Final numbers (`npm run perf`, production build, headless Chromium with the CPU slowed; DOM baseline from ticket 103 in brackets)

| At 4× slowdown | 60×90 | 70×250 | 250×250 |
| --- | --- | --- | --- |
| open | 119 ms (349) | **141 ms** (946) | 254 ms (3,079) |
| hover | **60 fps** (11) | **60 fps** (3) | **60 fps** (1) |
| paint stroke | **60 fps** (23) | **60 fps** (7) | **60 fps** (2) |
| Selection drag / paste hover | 60 / 60 fps | 60 / 60 fps | 60 / 60 fps |
| scroll | 48 fps (21) | 54 fps (7) | 29 fps (2) |
| zoom step | 115 ms (163) | 121 ms (458) | 175 ms (1,497) |
| Convert image framing drag, loom / brick / peyote | 43 / 43 / 22 fps (18) | 30 / 30 / 17 fps | 9 / 7 / 6 fps |

At 6×: hover, paint, Selection drag and paste hover are 60 fps at every size (5–11 ms); open 166 / 185 / 350 ms; scroll 49 / 49 / 60 fps; zoom step 140 / 164 / 249 ms; framing 23 / 23 / 11 fps at 70×250 and 9 / 9 / 3 fps at 250×250.

On the floor (4×), hover and paint are 60 fps at 70×250 and at 250×250, which is what this ticket asked. Still under it, as ticket 108 recorded: scrolling a 250×250 Pattern (29 fps; nothing is redrawn while it scrolls, and it does not grow with the Pattern), and the Convert image framing drag at 250×250 and in peyote above 60×90. The manual iPad Air 13″ pass is ticket 120.
