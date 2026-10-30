# PrintChartPage

A chart page of the PDF: one part, as many beads as fill the page, every bead lettered and every 5th row and column numbered. It is for working from at the craft table, and it has to read in black-and-white print and zoomed in on a screen.

Signed off in the design session of 2026-10-27 (tickets 0585, 0586, 0588; the claude.ai canvas "Printed chart pages"). Sizes are on A4 portrait, measured from the page's top left corner; colors are tokens.

## What is drawn how

- **Vector** (PDF drawing operators, ADR 0043): bead fills and shapes, every line, the pad outline, the overlap line, the mini map, the Swatch letters and the ruler numbers. Letters and digits use the PDF's built-in **Helvetica** and **Helvetica-Bold** (nothing embedded).
- **Picture**: the page's translated text (header, part label, "Colors on this page" and the key's color names, footer). It is drawn in the app's fonts at 300 dpi (150 where the device cannot allocate a 300 dpi page) as one picture laid **under** the vector drawing.

## Page layout

| Band | Where | Size |
| --- | --- | --- |
| Margin | all four sides | `print-margin` (10 mm) |
| Header | 10–22 mm | 12 mm (`print-header`) |
| Gap | 22–25 mm | 3 mm |
| Pad | from 25 mm | ruler band + chart + ruler band |
| Key | under the pad | 6.5 mm + 4.5 mm per row of colors |
| Footer | 281–287 mm | 6 mm (`print-footer`) |

- The chart is `print-chart-cell` (3 mm) per bead. The chart area is 180 mm wide (190 mm less two `print-ruler` bands): **60 beads across**. Its height is 243 mm less the key, rounded down to whole beads: 75 rows with a two-row key (7–12 colors), 77 with one row (up to 6), 74 with three (up to 18).
- **The key's height is set once per PDF** from the chart page with the most colors. Every part of the Schema then has the same height and the pages line up. A 100 × 100 is 2 × 2 parts (60 + 40 across, 75 + 25 down).
- The pad's left edge sits on the left margin. A part narrower than the chart area keeps that left edge and is not centred, so every page of a Schema shares the same left edge.

## Beads and letters

- **Square beads** (loom, Delica): a 3 mm square, filled with the bead's color, edge to edge with its neighbours.
- **Every bead carries its Swatch letter**, whether the Letters toggle is on or off, in every Technique. The letter is Helvetica-Bold **6.5 pt** (`print-letter`), centred across using its Helvetica width. Its baseline is **2.32 mm** below the cell's top: the cell's centre plus half of Helvetica's cap height (0.718 em).
- A two-letter Swatch letter (AA, AB…) is drawn at the same size, squeezed to `--print-letter-squeeze` (72%, PDF `Tz 72`) so it fits in 2.4 mm.
- **White or black**: take the WCAG relative luminance of the bead's color. Above `--print-letter-balance` (0.1791) the letter is `ink`, otherwise `canvas` (white). 0.1791 is where black and white contrast equally, the same rule as `markOn` in `swatchMark.ts`. Because the rule follows lightness, the choice still holds on a gray-only printer.
- **Empty position**: no fill, no letter; only the cell lines cross it, so it shows as plain paper.
- **White bead**: filled with its color like any bead, with its letter in `ink`. The letter is what tells it from an empty position.

## Lines

Drawn over the fills and under the letters, in this order:

| Line | Weight | Color |
| --- | --- | --- |
| Between cells | `print-line-cell` 0.1 mm | `line-strong` |
| After every 5th bead | `print-line-five` 0.18 mm | `field-line` |
| After every 10th bead, and the chart's outer edge | `print-line-ten` 0.3 mm | `ink` |

The lines count from the Schema's first bead, not the part's. On part B (columns 61–100), the heavy lines fall after 70, 80 and 90.

## Pad

- A rounded rectangle round the chart and its four ruler bands, **outline only**: `print-pad-line` (0.2 mm) in `faint`, with corners of `print-pad-radius` (2 mm). It has no fill, so only beads take toner. Chart pages don't use `print-board`.

## Rulers

- A `print-ruler` (5 mm) band on all four sides, inside the pad. A number at **every 5th** row and column (5, 10, 15…), on all four sides, upright. They are the Schema's own numbers: a part that starts at 61 shows 65, 70…
- Fives are Helvetica 6.5 pt (`print-letter`) in `muted`; tens are **Helvetica-Bold** in `ink`.
- Column numbers are centred on their column. At the top, the baseline is 1.5 mm above the chart; at the bottom, the cap top is 1.5 mm below it (baseline 3.15 mm below).
- Row numbers share their row's letter baseline. On the left they are right-aligned 1.3 mm from the chart; on the right, left-aligned 1.3 mm from it.
- No ticks, and no number 1.

## Overlap

- A part repeats `print-part-overlap` (2) columns or rows of the part before it.
- **Tint**: the overlap fills are mixed `print-overlap-tint` (60%) toward white. Their letters are `muted` whatever the color, their ruler numbers `faint`, and their lines are drawn as usual.
- **Where the part begins**: one `print-overlap-line` (0.5 mm) `accent` line on that cell boundary, running the pad's full height (or width), through the rulers. A grayscale printer turns it into a mid-gray line, and the tint stays lighter than the beads around it.
- The overlap counts in the part's size, so a part with its overlap still fits 60 × 75.

## Header

- Line 1, baseline 16.4 mm: the technique word ("loom") in Instrument Serif italic 14 pt `accent`, then a 1.6 mm space, then the title (the Frame's name, else the Project's; ticket 0719) in Inter 600 13 pt `ink`.
- Line 2, the **part label**, baseline 21.4 mm, in DM Mono 7.5 pt `muted`: "part A · columns 1–60 · rows 1–75 · by {maker}". The range is the part's own, without the overlap. The maker is cut at 32 characters with an ellipsis, and " · by {maker}" is left out when the maker's name is empty.
- Right: the page number in Inter 600 18 pt `ink`, then 0.8 mm and "/ 9" in DM Mono 8 pt `muted`. Its right edge is on the right margin, baseline 18.6 mm.
- Left of the page number, 3 mm from it, with its top at 11.6 mm: the **mini map**. It shows the parts to scale in a 9.4 mm square, 0.4 mm apart, corners 0.3 mm. The current part is filled `accent`; the others are a 0.15 mm `faint` outline.
- No chart-style line and no date: the date is in the footer.

## Colors on this page

- The key starts 4 mm under the pad. The label "Colors on this page" is Inter 600 7 pt `ink`, baseline 6.3 mm under the pad.
- Then the colors on this page (overlap included), in Swatch letter order, reading across. They sit in `print-key-columns` (6) columns of 31.67 mm, rows 4.5 mm apart; the first row's top is 8 mm under the pad.
- Each color has a 3 mm swatch drawn exactly like a bead on this page: its fill, a 0.1 mm `line-strong` edge, and its letter by the rule above (a round bead on a round-bead page). Then 1.6 mm, then the color name in Inter 400 7 pt `ink`, its baseline level with the letter's. No counts: the totals are on the Specification.
- Nothing else goes under the board. The line on how to read the numbers is gone: numbers every 5 need no explanation.

## Footer

- Baseline 285.4 mm. Left: the X1 mark (`bd-beads-mark-ink.svg`) at 3.6 mm with its top at 282.3 mm; 1.2 mm; "openbeads" in Inter 600 7.5 pt `ink`; 2 mm; the date and time in DM Mono 7.5 pt `muted` ("27 Oct 2026 · 14:05").
- Right, aligned to the right margin: "Continues right on page 3, below on page 4 →" or "Last part" (writing.md), in Inter 500 7.5 pt `ink`.

## Other bead shapes

The beads follow the canvas drawing (ticket 0585). The letters, rulers, key and tint are the same as for square beads.

- **Round beads**: a circle 2.6 mm across, centred in its 3 mm cell, filled, with a 0.1 mm `line-strong` edge so a White bead shows. There are no lines between cells; the 5th and 10th lines run in the gaps between the circles. An empty position draws nothing.
- **Brick stitch**: every other row is offset by half a bead, as on the canvas. The cells are squares with their cell lines. The 5th and 10th lines across the rows are straight; the ones down the columns step with each row's offset. Column numbers sit over the first row's beads. No outer edge line: the outermost cell lines are the edge.
- **Peyote**: the same, with every other column offset half a bead down. The lines down the columns are straight; the ones across step with each column. Row numbers sit beside the first column's beads.
- **A Custom frame** (ticket 0594): the parts tile its bounding rectangle as for any Frame. Each bead is drawn at its centre, turned to its panel's angle, filled, with a 0.1 mm `line-strong` edge (round beads as circles), its letter upright at its centre; an empty position is outlined 0.1 mm `faint` so the shape reads; the Seams are 0.18 mm `field-line` lines. A bead belongs to the part its centre falls in. There are no cell lines, no 5th or 10th lines and no rulers: its beads keep no rows and columns.

## Shared sheets

- Parts that fit together share a sheet in reading order, each on its own pad, 6 mm apart. Each pad gets its label 2 mm above it, in DM Mono 7.5 pt `muted` ("part B · columns 101–130 · rows 1–100"). The header's line 2 then names only the Project and the maker. The sheet has one key.

## Acceptance

A build agent checks each of these on a 100 × 100 loom Schema with an empty background, White beads and dark beads (the canvas mock), with Letters off:

- [ ] Chart pages are vector. The only image on a chart page is the text picture, and it lies under the drawing. Letters and numbers are text in `/Helvetica` or `/Helvetica-Bold`, not embedded fonts.
- [ ] A bead is 3 mm. Part A is 60 columns × 75 rows. The pad's left edge is at 10 mm and its top at 25 mm.
- [ ] Every non-empty position has its letter in Helvetica-Bold 6.5 pt, centred across, baseline 2.32 mm below its cell top. No empty position has a letter or a fill.
- [ ] A bead with luminance > 0.1791 has an `ink` letter, otherwise white. A White bead has an `ink` letter.
- [ ] A two-letter Swatch letter is drawn at 72% horizontal scale and stays inside its cell.
- [ ] Cell lines are 0.1 mm `line-strong`, every 5th 0.18 mm `field-line`, every 10th and the edge 0.3 mm `ink`, counted from the Schema's first bead.
- [ ] The pad is a 0.2 mm `faint` outline with 2 mm corners and no fill.
- [ ] Ruler numbers appear only at multiples of 5, upright, on all four sides, at 6.5 pt and the offsets above: tens Helvetica-Bold `ink`, fives Helvetica `muted`.
- [ ] On part B, columns 59–60 are tinted 60% toward white, with `muted` letters and `faint` numbers, and a 0.5 mm `accent` line runs the pad's full height between columns 60 and 61.
- [ ] The header has the two lines, the page number and the mini map as above, and no chart-style or date line.
- [ ] "Colors on this page" shows this page's colors only, in 6 columns: the swatch with its letter, then the name, no counts. The key is the same height on every chart page of the PDF.
- [ ] The footer has the mark, "openbeads", and the date and time on the left, and the continuation on the right.
- [ ] Round, brick and peyote pages are drawn as "Other bead shapes" says.
- [ ] Printed in black and white, every letter is readable, empty positions are white, and overlap columns are lighter than their neighbours. Zoomed to 800 % on a Retina screen, letters and lines are sharp.

The earlier cards (1.75 mm and 2.3 mm cells, odd and even numbers turned upwards, counts in the key) are in git history.
