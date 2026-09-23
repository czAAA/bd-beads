# 74: PDF export

**What to build:** Add a PDF export option for a Pattern, suitable for printing at the craft table: the rendered chart plus a color legend and Bead quantities.

**Blocked by:** 67 (Pattern renderer)

**Note (performance plan, ADR 0018):** the chart is drawn with the Pattern renderer from 67, the same one the editor uses, so it looks like the on-screen Pattern. It must handle the large Patterns the performance work allows (70×250 and 250×250), for example by splitting the chart across pages.

**Status:** done

- [x] A Pattern can be exported as a PDF containing the rendered chart, a color legend, and Bead quantities
- [x] The PDF is legible when printed on standard paper sizes

**Done:** Toolbox → Edit group has an "Export as PDF for printing" button. A4 pages at 150 dpi: the color legend (swatch, hex, beads of each, total) first, then the chart at 4.6 mm a bead, cut between beads into as many pages as it needs ("Part n of m across, n of m down" on each). Pages are drawn on canvases (so the labels follow the app's language with no font to embed) and wrapped by `src/domain/pdfDocument.ts`, a small PDF writer for JPEG pages. Checked with `e2e/visual/export.spec.ts` and by opening a generated file in poppler. Not done: row/column numbers along the edges of a printed piece.
