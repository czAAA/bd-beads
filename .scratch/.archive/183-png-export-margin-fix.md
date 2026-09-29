# 183: Fix PNG export margin regression

**What to build:** Restore PNG export's margin so the exported image isn't cropped, matching the margin already fixed for PDF export in #164.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] PNG export has the same margin as the PDF export's page-1 image
- [x] PNG and PDF exports of the same Pattern show visually equivalent framing, just different file formats

**Done (ticket 183):** Two bugs, found by exporting real PNGs and inspecting pixels rather than by inspection alone. First, the board rect `drawPngBackground`/`clipToPngBoard` drew the watermark and accent line against (`patternExport.ts`) was the full margin-inclusive chart rect, not the tighter bead rect the PDF page-1 board is — pushed past the margin, the watermark's baseline landed outside the picture for a Pattern whose story sits beside it rather than under it. Fixed with `pngBoardRect`, padded the same small amount (`PRINT_BOARD_PAD`) as the PDF board. Second, even corrected, the bottom margin (`PNG_MARGIN_PX`, sized for the rulers) had no room left for the 40 pt background name's own baseline offset and descender: a new `PNG_BOTTOM_MARGIN_PX` (100px) gives the bottom its own, taller margin, `pngZoom`'s pixel-budget quadratic now solves for the two different borders, and `exportPatternPng`'s `chart`/`beads` rects use it. A second, unrelated bug surfaced while checking a wide Pattern specifically: `renderPattern` repaints its whole region every band — taller than the chart alone whenever the picture carries a story underneath — so drawing the background before it left it painted over and invisible for exactly that shape; moving the draw to after the board (and beads) fixed it for both shapes, confirmed by four repeated exports each. Covered by `patternExport.test.ts` (`pngBoardRect`) and two `e2e/visual/export.spec.ts` cases (a typical and a wide Pattern with a maker name), and checked visually against real exported PNGs.
