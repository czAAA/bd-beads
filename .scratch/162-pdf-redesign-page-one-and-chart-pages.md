# 162: PDF for printing: page 1 and chart pages

**What to build:** The PDF for printing follows `printed-output.md` and the PrintPage1 and PrintChartPage cards. Page 1 shows the whole Pattern as large as the sheet allows on the pale print board, with rulers every 10, the 10-bead lines and the chart parts dashed and numbered, plus a 48mm side column: Beads needed with bead-shaped swatches, beads and grams per color and in the Total, a note on how grams are worked out, then Made by, Technique, Bead, Size and Estimated size. Chart pages split the Pattern into equal parts that each fill their page at one bead size (never above 7mm), with a 16mm header (technique word, name, part, maker, date, page number, mini map) and an 8mm footer saying where the chart continues. Every page carries the X1 mark, the technique word in Instrument Serif italic, the background curve and the maker's name, with the accent kept light so a black-and-white printer loses nothing.

**Blocked by:** 140, 161

**Status:** done

- [x] Page 1 and chart pages match their cards on A4 portrait
- [x] Grams are the count divided by the Bead's beads per gram, rounded up to 0.1g with a trailing ".0" dropped; the Total is rounded up from the total count
- [x] Every page shows the mark and "bd-beads", technique and name, the maker's name (left out when empty), the export date and time, and "Page 2 of 5"
- [x] The export uses the light values regardless of the app's theme
- [x] The Russian export fits (longer technique word, Cyrillic fallback fonts)
- [x] Export stays within today's memory and time limits for large Patterns (ADR 0019); `patternExport` tests are updated

**Done (ticket 162):** the PDF is planned in `rendering/printPlan.ts` (A4 at 150 dpi, the page count from the 4.6 mm base, equal parts, one bead size up to 7 mm, the "continues" pages), worded in `rendering/printText.ts` (all strings in the app's language, grams by `domain/printGrams.ts`: rounded up to 0.1 g, trailing .0 dropped, decimal comma in Russian, the Total from the total count), and drawn in `rendering/printPages.ts`, loaded only when a PDF is asked for. The print colors, sizes and opacities are tested equal to tokens.json. Page 1: brand, maker, date and time; the technique word and name; the meta line; how to read the parts; the whole Pattern with rulers every 10, the 10-bead lines and the parts dashed and numbered; the 48 mm Beads needed column with beads and grams, the note and the facts (under the board for a wider-than-tall Pattern). Chart pages: the 16 mm header with the mini map, rulers on four sides (every 5th muted, every 10th bold), the name band and the footer's "Continues right on page 3, below on page 4 →". The old `pdf*` strings became the `print` section; the old planChart and its tests are gone (printPlan.test.ts replaces them). Checked by exporting a 60×80 Delica Pattern in Chromium. Landscape and stacked strips are ticket 163.
