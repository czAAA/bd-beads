# PrintWordChart

The Word chart pages of the PDF, after the Specification, only when Letters is on: the written rows a weaver follows beside the chart (tickets 0574, 0586; glossary: Word chart). There is no Word chart PNG.

Signed off in the design session of 2026-10-27 (the claude.ai canvas "Printed chart pages"). Sizes are on A4 portrait, measured from the page's top left corner; colors are tokens. The page is a picture like the Specification (300 dpi, 150 where the device cannot allocate it).

## Header

- Line 1, baseline 14 mm: "loom · {name} · {maker}" in DM Mono 7.5 pt `muted` (an empty name or maker is left out with its " · ").
- Line 2, baseline 22.4 mm: "Row by row" in Inter 600 16 pt `ink`, then 1.6 mm, then **this page's rows** ("1–82", "83–120"), from the first line's first row to the last line's last row (peyote's "1&2" line starts the range at 1) in Instrument Serif italic 17 pt `accent`. Never the whole Schema's range.
- Right: the page number as on PrintChartPage (Inter 600 18 pt, "/ 9" in DM Mono 8 pt `muted`, baseline 18.6 mm).

## Color key

- On every Word chart page: a strip 26.5 mm from the top, the full content width (190 mm), outlined like the chart pad (0.2 mm `faint`, corners 2 mm, no fill). It is 8 mm tall for one row of colors and grows 4.5 mm for each further row.
- In it, the colors in Swatch letter order, 31 mm apart, starting 3 mm in: a 3 mm swatch drawn like a chart bead (fill, 0.1 mm `line-strong` edge, its letter on it by PrintChartPage's white-or-black rule), then 1.6 mm, then the name in Inter 400 7 pt `ink`. When the Schema has empty positions, the last item is an empty swatch with `*` in `muted` and "empty".
- Under the strip, 6 mm below its bottom edge: one line in Inter 7.5 pt `muted` saying where Row 1 is and what a run is ("Row 1 is at the top of the picture. All rows read left to right; 3D is three beads of D."). Peyote adds "Even count" or "Odd count".

## Rows

- The first row's top is 3.4 mm under that line (44 mm on a page with a one-row key). Rows are `print-word-pitch` (5.6 mm) apart.
- Each row, left to right:
  1. A tick box: a 2.8 mm square, 0.2 mm `field-line` outline, corners 0.4 mm, its top 1.4 mm below the row's top.
  2. The row number in DM Mono 500 `print-word-row` (10 pt) `ink`, right-aligned 11.5 mm from the box's left edge ("1&2" fits).
  3. The (L) or (R) marker, for peyote and brick only, in DM Mono 10 pt `muted`, 1 mm after the number. The runs follow it.
  4. The runs in DM Mono 400 10 pt `ink`, from 13.5 mm after the box's left edge (2 mm further with a marker), in the 0574 notation ("3A, 7B, 2*").
- Text baseline: 3.9 mm below the row's top.
- A hairline under each row, across the column: 0.15 mm `line-soft`, and under every 5th row 0.2 mm `line-strong`, so the rows can be counted as on the chart.
- The number of runs on the right is gone: it is not something a weaver works from.
- A row too long for its column wraps at a run, with a hanging indent at the runs' start; the wrapped line adds one pitch. A row never splits across columns or pages.

## Two columns

- When the longest row's line (number, marker and runs) fits **91 mm**, the page runs in two columns: the left from 10 mm, the right from 109 mm, a `print-word-gap` (8 mm) gutter between them, **no rule** between them. The rows read down the left column, then down the right.
- Otherwise one column, 190 mm wide, with the same row parts.
- One decision per PDF: all Word chart pages of a Schema have the same columns.
- Rows per column: as many whole rows as fit between the first row's top and 277 mm (41 on a page with a one-row key). A two-column page holds twice that ("Row by row 1–82").

## Footer

- As on PrintChartPage: the mark, "openbeads", and the date and time on the left. On the right, "Rows 83–120 on page 8 →" when the rows go on, nothing on the last page (writing.md).

## Acceptance

A build agent checks on a 35 × 120 loom bracelet and a 100 × 100 loom Schema, Letters on:

- [ ] No `_instructions` PNG is made. The Word chart pages follow the Specification in the PDF.
- [ ] Each page's title names its own rows: 35 × 120 gives "Row by row 1–82" then "83–120".
- [ ] 35 × 120 runs in two columns of 41 rows each (left x 10 mm, right x 109 mm, no rule between them). 100 × 100 runs in one column.
- [ ] Rows are DM Mono 10 pt with a 5.6 mm pitch: the tick box, then the number (500, right-aligned), then the runs. No run count.
- [ ] Each row has a `line-soft` hairline under it, and every 5th row a `line-strong` one.
- [ ] A row never splits across a column or a page. A wrapped row indents to its runs.
- [ ] The color key strip is an outline with no fill, its swatches drawn like chart beads with their letters, and `*` empty listed when the Schema has empty positions.
- [ ] Peyote's first line is "1&2". Peyote and brick lines carry (L)/(R) in `muted`. The run notation is unchanged from 0574.

The earlier card (whole-range title, runs count, key strip on `print-board`) is in git history.
