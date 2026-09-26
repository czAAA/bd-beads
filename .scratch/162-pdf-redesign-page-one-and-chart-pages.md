# 162: PDF for printing: page 1 and chart pages

**What to build:** The PDF for printing follows `printed-output.md` and the PrintPage1 and PrintChartPage cards. Page 1 shows the whole Pattern as large as the sheet allows on the pale print board, with rulers every 10, the 10-bead lines and the chart parts dashed and numbered, plus a 48mm side column: Beads needed with bead-shaped swatches, beads and grams per color and in the Total, a note on how grams are worked out, then Made by, Technique, Bead, Size and Estimated size. Chart pages split the Pattern into equal parts that each fill their page at one bead size (never above 7mm), with a 16mm header (technique word, name, part, maker, date, page number, mini map) and an 8mm footer saying where the chart continues. Every page carries the X1 mark, the technique word in Instrument Serif italic, the background curve and the maker's name, with the accent kept light so a black-and-white printer loses nothing.

**Blocked by:** 140, 161

**Status:** ready-for-agent

- [ ] Page 1 and chart pages match their cards on A4 portrait
- [ ] Grams are the count divided by the Bead's beads per gram, rounded up to 0.1g with a trailing ".0" dropped; the Total is rounded up from the total count
- [ ] Every page shows the mark and "bd-beads", technique and name, the maker's name (left out when empty), the export date and time, and "Page 2 of 5"
- [ ] The export uses the light values regardless of the app's theme
- [ ] The Russian export fits (longer technique word, Cyrillic fallback fonts)
- [ ] Export stays within today's memory and time limits for large Patterns (ADR 0019); `patternExport` tests are updated
