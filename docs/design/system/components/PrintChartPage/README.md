# PrintChartPage

A chart page of the PDF: one part of at most 100 × 100 beads with every row and column numbered, to work from at the craft table.

- Parts are cut at `print-part-beads` (100) from the top left; a 130-bead side is 100 + 30. Every part is drawn at `print-chart-cell` (1.75 mm), so a full part fills the sheet's width and all pages share one bead size.
- Leftover parts share a sheet when they fit at that size, each on its own board labelled "part B · columns 101–130 · rows 1–100".
- Rulers in a `print-ruler` band on all four sides: odd numbers top and left, even numbers bottom and right, so each number appears once; column numbers turned to read upwards. Every 10th `ink` 500, every 5th `ink`, the rest `muted`. A fine line every 5 beads, a heavier one every 10.
- Overlap: `print-part-overlap` (2) columns or rows of the previous part, shaded, numbers `faint`, an `accent` line where the part begins.
- Letters on: each bead carries its Swatch letter (white on dark beads, `ink` on light) at 6.5 pt, so the cell is `print-chart-cell-letters` (2.3 mm) and parts are at most `print-part-beads-letters` (75) a side. Off: color only, 1.75 mm, 100-bead parts.
- Header: technique word and name; the part, the chart style, maker, date and time; a mini map (current part `accent`) and the page number, large. Under the board: the color key for this page with counts, how to read the numbers, where the chart continues. Footer: brand, "Continues right on page 3, below on page 4 →" or "Last part" (writing.md).
- No watermark over or behind the chart.

Rewritten for the export sheets signed off on 2026-10-26 (ticket 0575); the earlier card (equal parts grown to fill the sheet, the name band) is in git history.
