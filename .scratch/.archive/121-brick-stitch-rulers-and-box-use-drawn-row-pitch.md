# 121: Brick stitch's rulers and canvas box use the row pitch that is drawn

**What to build:** Brick stitch rows are drawn 21 px apart: each row after the first has a 1px seam above it that takes height of its own (`rowPitchPx` in `src/rendering/patternRenderer.ts`, which is what the DOM grid always did too). The layout maths outside the renderer still assumes 20 px (`rowHeightPx` / `gridHeightPx` in `src/domain/grid.ts`, which the millimetre framing maths needs as it is), so for a brick stitch Pattern with many rows:

- the row ruler's numbers are spaced 20 px apart against rows 21 px apart, so they drift one pixel per row (a Pattern 90 rows tall: 89 px at 100% zoom, more than four rows by the bottom);
- the box the Pattern sits in (`canvasContentHeightPx`) is sized from the 20 px height, and the Pattern's drawing is cut off by the box's rounded clip below it, so the last rows (and the bottom ruler) are partly out of sight (measured at 90 rows and 100% zoom: the Pattern reaches 61 px past the box, the last three rows);
- the fit-to-panel zoom (`computeFitZoom`) is off by the same proportion when the Pattern is rotated (fit by height).

None of this is new: the one-element-per-bead grid it replaced had the same drift and the same clipping, and ticket 104 fixed the framing preview's copy of it. Fix the three consumers (`PatternRuler.vue`, `PatternCanvas.vue`'s box, `usePatternZoom`) to use the renderer's geometry (`rowPitchPx`, `patternExtentPx`) and leave the domain functions alone for the millimetre maths.

**Blocked by:** None

**Status:** done

- [x] The row ruler's numbers line up with brick stitch's rows at every zoom, upright and rotated, at 10 rows and at 90
- [x] The box shows every row of a brick stitch Pattern and its bottom ruler, at every zoom
- [x] Fit-to-panel zoom fits a rotated brick stitch Pattern
- [x] Loom and peyote are unchanged (their rulers and box are pixel-for-pixel as before)
- [x] A test for each: the ruler's label positions, the box's height against `patternExtentPx`, and the fit zoom, for brick stitch at more than a handful of rows
