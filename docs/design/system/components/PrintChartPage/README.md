# PrintChartPage

A chart page of the PDF: one part, as many beads as fill the page, with every row and column numbered, to work from at the craft table.

- Parts are cut from the top left, each as many beads across and down as fit the chart area (rulers and overlap included) at `print-chart-cell` (3 mm); the last in each direction holds what remains. A 100 × 100 is 2 × 2 parts. All pages share one bead size.
- Leftover parts share a sheet when they fit at that size, each on its own board labelled "part B · columns 101–130 · rows 1–100".
- Rulers in a `print-ruler` band on all four sides: odd numbers top and left, even numbers bottom and right, so each number appears once; column numbers turned to read upwards. Every 10th `ink` 500, every 5th `ink`, the rest `muted`. A fine line every 5 beads, a heavier one every 10.
- Overlap: `print-part-overlap` (2) columns or rows of the previous part, shaded, numbers `faint`, an `accent` line where the part begins.
- Letters on: each bead carries its Swatch letter (white on dark beads, `ink` on light) at 6.5 pt, which the 3 mm cell holds; size and parts are the same with Letters off.
- Header: technique word and name; the part; a mini map (current part `accent`) and the page number, large. Under the board: the color key for this page with counts, how to read the numbers, where the chart continues. Footer: brand and date, "Continues right on page 3, below on page 4 →" or "Last part" (writing.md).
- No watermark over or behind the chart.

Rewritten for the export sheets signed off on 2026-10-26 (ticket 0575); the earlier card (equal parts grown to fill the sheet, the name band) is in git history.
