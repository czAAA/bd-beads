# 74: PDF export

**What to build:** Add a PDF export option for a Pattern, suitable for printing at the craft table: the rendered chart plus a color legend and Bead quantities.

**Blocked by:** 67 (Pattern renderer)

**Note (performance plan, ADR 0018):** the chart is drawn with the Pattern renderer from 67, the same one the editor uses, so it looks like the on-screen Pattern. It must handle the large Patterns the performance work allows (70×250 and 250×250), for example by splitting the chart across pages.

**Status:** ready-for-agent

- [ ] A Pattern can be exported as a PDF containing the rendered chart, a color legend, and Bead quantities
- [ ] The PDF is legible when printed on standard paper sizes
