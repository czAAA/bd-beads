# PrintChartPage

A chart page of the PDF: one equal part of the Schema, at the largest bead the sheet allows, or the whole Schema drawn the same way on page 1 when it fits there (PrintPage1, ticket 0914), every bead lettered and every row and column numbered. It is for working from at the craft table, and it has to read in black-and-white print and zoomed in on a screen.

Signed off in the design session of 2026-10-27 (tickets 0585, 0586, 0588; the claude.ai canvas "Printed chart pages"). Sizes are on A4 portrait, measured from the page's top left corner; colors are tokens.

## The new chart: approved 2026-11-19 (tickets 1126, 1127; 1126, 1128 and 1129 are in the app, 1127 not yet)

Signed off by the owner on 2026-11-19 (ticket 1123; the claude.ai page "PDF chart, beads only", linked on the ticket): a loom piece, a turned peyote two-drop and a Custom frame, each with Empty grid off and on, and the rulers close up. Until ticket 1127 lands, the rest of this card describes the chart as it prints, with Empty grid on and Chart border on. Part by part:

- **No lines inside the chart, and no bold edge** (ticket 1126; in the app). The lines every 5th and 10th bead and the chart's 0.3 mm `ink` outer edge go; nothing is drawn between beads but their borders. Each colored square bead is filled and bordered on its own, `print-line-cell` (0.1 mm) in `line-strong`, so two neighbours share one hairline and a staggered row (brick stitch, peyote, any Drop) is outlined bead by bead and never stepped. A round bead keeps its circle's edge as today. The overlap's line, the letters and the key stay as they are; the pad's outline becomes the chart's rim (next). With Black and white on (PrintBlackAndWhite card, not yet in the app) a solid black bead keeps its 0.2 mm of paper to its neighbours in place of the border.
- **One rounded rim, the numbers outside it** (approved 2026-11-20; ticket 1126, in the app; its switch, **Chart border**, ticket 1127), on at first. The pad's rounded outline (`print-pad-line`, 0.2 mm `faint`, corners `print-pad-radius`, 2 mm), which today goes round the chart and its four ruler bands, moves in to `print-rim-gap` (1 mm) clear of the trimmed chart's outermost beads, an even margin on every side. It is the only line round the chart: no straight line under the ruler numbers, no edge on the beads, no second outline outside the numbers. The ruler numbers stand outside it, in the rest of their `print-ruler` band, and no bead touches it: on a staggered side (brick stitch's left and right, a turned peyote's) it runs straight, 1 mm clear of the outermost beads, and a row set in by half a bead stands a little further inside it. A Custom frame gets the same rim round its trimmed beads, with no numbers. A part's overlap line still runs through the rim and the rulers. With Chart border off nothing goes round the chart: the beads and their numbers stand on bare paper. (The owner marked this on the drawing on 2026-11-19: keep the rounded rim, remove the straight line under the numbers, move the numbers outside the rim.)
- **Empty grid** (ticket 1127; the Export panel's new switch, ExportPanel card), off at first. Off, an empty position is bare paper: no cell line, no outline, no cross. On, it is drawn as it prints today: a square chart's cell line (`print-line-cell` in `line-strong`) and the small `faint` cross, a round bead's cross alone, a Custom frame's `faint` outline and cross. Colored beads look the same either way. It is the same rule on page 1's whole chart, its strips and every chart page.
- **Trimmed to the beads** (ticket 1128; in the app). The chart holds only the rows and columns from the first bead to the last, across and down: the empty rows and columns round the drawing are left out, and empty positions inside it stay (Empty grid says how they look). The plan sizes the bead, the parts and the pages from the trimmed chart, so a small piece on a large Frame prints larger: a 13-wide piece on a 30 × 39 loom Frame is a 13 × 30 chart at about 5.1 mm a bead, where the whole Frame was about 4.0 mm. A staggered chart is the union of its trimmed rows' cells, so its edge follows the stagger. A Schema with no beads prints whole.
- **Rulers go 1 to the end** (ticket 1129; in the app). Every column and every row has its number, on all four sides: across 1, 2, 3… from the left on the top and bottom rulers, down 1, 2, 3… from the top on the left and right rulers, whichever way the Schema is turned, starting at the trimmed chart's first column and row. A part counts on from where the one before it ends: a part from column 61 shows 61, 62… (its overlap 59, 60 `faint`). Every number is Helvetica (regular) in `muted`, the 10ths included: nothing is set apart, no bold and no `ink`. Places are those under Rulers below, measured from the rim (1126) instead of the chart: a column number centred on its column (over the first row's bead in a staggered chart), its baseline 1.5 mm above the rim and its cap top 1.5 mm below it; a row number on its row's letter baseline, 1.3 mm from the rim. They keep those places with Chart border off. No ticks.
  - **One size for every ruler number on a page** (approved 2026-11-20). Top, bottom, left and right, one digit to three, the page's numbers share one size: the largest, at most `print-letter` (6.5 pt), at which the page's widest numbers fit. The widest column number takes at most `print-ruler-fit` (80%) of its column's width, so neighbours keep a gap; the widest row number's digits (Helvetica's cap height, 0.718 em) at most 80% of its row's height, and it is no wider than its ruler band leaves (2.7 mm: `print-ruler` less the 1 mm rim gap and the 1.3 mm gap to the rim). So the numbers never start bigger and shrink at 10 or 100, and rows are never larger than columns. A page that shares several parts or strips sets them all in one size. Another page may get another size, from its own bead and widest number: a 13 × 30 at 5.1 mm and a 24 × 13 at 6 mm keep 6.5 pt; part B of a 150 × 100 at 2.3 mm (to column 150) is 3.1 pt; a 100 × 100 at 1.8 mm is 2.4 pt; any page with a three-digit row is at most about 4.6 pt, its band's limit. This is the one exception to the 6.5 pt floor (printed-output.md), and it holds for ruler numbers only.
  - Everything else on paper that names a row or column uses the ruler's number: the part label ("part B · columns 76–150 · rows 1–100"), "Continues right on page 3", the overview's cut pills ("76 →") and Row by row (PrintWordChart card). The parts are cut on the ruler's tens, counted the same way: where a cut moves to a multiple of 10, a part starts at 11, 21… 61. The editor keeps its own numbering.
- **A Custom frame** still has no rulers: its beads keep no rows and columns. It is trimmed to the rectangle round its colored beads, and with Empty grid on an empty position is outlined only when it lies wholly inside that rectangle, so no outline is cut at the edge. Its Seams stay, `print-line-five` (0.18 mm) in `field-line`, cut to the rectangle.

The owner agreed on 2026-11-19 (ticket 1123): Empty grid on showing exactly today's empty look, a Custom frame's empties only when wholly inside, its Seams staying, the ruler's numbers everywhere on paper, and the black bead's paper in Black and white; every ruler number regular and `muted`; and one rounded rim round the beads with the numbers outside it, with a switch for it. On 2026-11-20 the owner approved the rim and the switch as proposed (Chart border, on at first, its copy and file word) and asked for one ruler number size per page in place of each number shrinking on its own.

Acceptance, for the build tickets:

- [x] (1126) No line runs between beads or after every 5th or 10th, and there is no 0.3 mm edge; every colored square bead has its own 0.1 mm `line-strong` border, and a brick, peyote or two-drop chart shows no stepped line.
- [x] (1126) One rounded rim (0.2 mm `faint`, 2 mm corners) goes round the trimmed beads 1 mm clear of the outermost ones on every side, a Custom frame's too; the ruler numbers stand outside it; no other line goes round the chart, and no bead touches the rim.
- [ ] (1127) Chart border, on at first, shows or hides the rim and nothing else: the numbers keep their places.
- [ ] (1127) With Empty grid off no empty position has a line, outline or cross; on, each has today's cell line (outline on a Custom frame) and cross. Colored beads are the same either way.
- [x] (1128) A 13-wide piece on a 30 × 39 Frame prints a 13 × 30 chart, larger than the whole Frame did; empty positions inside the drawing stay; a Schema with no beads prints as today.
- [x] (1129) Every row and column carries its number on all four sides, from 1 at the trimmed chart's left and top for every turn, all Helvetica regular in `muted`, every number on a page in one size: the largest at which the page's widest column number fits 80% of its column and its widest row number its row and band, at most 6.5 pt; none is left out.

## What is drawn how

- **Vector** (PDF drawing operators, ADR 0043): bead fills and shapes, every line, the rim, the overlap line, the mini map, the Swatch letters and the ruler numbers. Letters and digits use the PDF's built-in **Helvetica** and **Helvetica-Bold** (nothing embedded).
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

- **The bead** (ticket 0913) is the same on every chart page of a PDF. The chart area is 180 mm wide (190 mm less two `print-ruler` bands) and 243 mm less the key high, less two ruler bands.
  - **One sheet**: the whole Schema at the largest bead that fits, up to `print-bead-max` (9 mm), when that is `print-bead-stretch` (1.6 mm) or more. 20 × 20 is 9 mm, 50 × 50 3.6 mm, 60 × 75 3 mm, 80 × 80 2.25 mm, 100 × 100 1.8 mm, 110 × 110 1.6 mm.
  - **Equal parts** otherwise: the fewest sheets that keep the bead at `print-bead-min` (1.8 mm) or more, then the largest bead those sheets allow, at most 3 mm. Each side is cut as evenly as whole beads allow (a 150 × 100 is 75 + 75 across at about 2.3 mm, a 150 × 150 2 × 2 parts), and a cut moves to a multiple of 10 where the parts still fit at that bead on as many sheets. Of plans within 0.05 mm of each other, the one with fewer parts wins.
  - **Two-letter Swatch letters** (more than 26 colors): the floor is 2.2 mm and there is no stretch.
- **The key's height is set once per PDF** from the chart page with the most colors. Every part of the Schema then has the same height and the pages line up.
- The pad's left edge sits on the left margin. A Schema whole on one sheet that is narrower than the chart area (a small one at 9 mm) is centred across it; parts keep the left edge, so every part page shares it.

## Beads and letters

- **Square beads** (loom, Delica): a square of the chart's bead, filled with the bead's color, edge to edge with its neighbours.
- **Every bead carries its Swatch letter**, whether the Letters toggle is on or off, in every Technique. The letter is Helvetica-Bold, centred across using its Helvetica width. It scales with the bead: **6.5 pt** (`print-letter`) on 3 mm, about 4.3 pt on 1.8 mm, larger above 3 mm; its cap height is 0.55 of the bead from 3 mm up, rising to 0.6 at 1.8 mm so a small bead's letter still reads. Its baseline is the cell's centre plus half of Helvetica's cap height (0.718 em): **2.32 mm** below the cell's top on a 3 mm bead.
- A two-letter Swatch letter (AA, AB…) is squeezed to `--print-letter-squeeze` (72%, PDF `Tz 72`). Any letter still wider than 90 % of its cell is set smaller until it fits, so a two-letter mark stays inside its cell.
- **White or black**: take the WCAG relative luminance of the bead's color. Above `--print-letter-balance` (0.1791) the letter is `ink`, otherwise `canvas` (white). 0.1791 is where black and white contrast equally, the same rule as `markOn` in `swatchMark.ts`. Because the rule follows lightness, the choice still holds on a gray-only printer.
- **Empty position**: no fill, no letter; a small `faint` cross, 0.1 mm (`print-line-cell`), 40 % of the bead across, centred in it (ticket 0818). It is the mark a chart reader knows as "no bead here", so an empty position is never taken for a White or pale bead.
- **White bead**: filled with its color like any bead, with its letter in `ink`. The letter is what tells it from an empty position.

## Lines

Drawn over the fills and under the letters (ticket 1126):

| Line | Weight | Color |
| --- | --- | --- |
| Each square bead's border, round its own cell | `print-line-cell` 0.1 mm | `line-strong` |

Two neighbours share one hairline. An empty position keeps its cell line while Empty grid is on (today always). There is no line after every 5th or 10th bead and no outer edge: the rim (below) is the only line round the chart.

## Rim

- One rounded rectangle, **outline only**, `print-rim-gap` (1 mm) clear of the chart's outermost beads on every side: `print-pad-line` (0.2 mm) in `faint`, with corners of `print-pad-radius` (2 mm). It has no fill, so only beads take toner. Chart pages don't use `print-board`. The pad, the chart and its four `print-ruler` bands, keeps its size for the layout; nothing is drawn at its edge.

## Rulers

- A `print-ruler` (5 mm) band on all four sides of the chart, the rim in its first 1 mm. **Every** row and column has its number, on all four sides, upright (ticket 1129): 1, 2, 3… from the left on the top and bottom, from the top on the sides, whichever way the Schema is turned, from the trimmed chart's first column and row. A part counts on from the one before it: a part that starts at 61 shows 59, 60 (its overlap, `faint`), 61, 62…
- Every number is Helvetica regular in `muted`, the tens too. Every number on a page is one size (above): 6.5 pt (`print-letter`) where the page's widest number fits, smaller where it does not.
- Column numbers are centred on their column. At the top, the baseline is 1.5 mm above the rim; at the bottom, the cap top is 1.5 mm below it.
- Row numbers share their row's letter baseline. On the left they are right-aligned 1.3 mm from the rim; on the right, left-aligned 1.3 mm from it.
- No ticks.

## Overlap

- A part repeats `print-part-overlap` (2) columns or rows of the part before it.
- **Tint**: the overlap fills are mixed `print-overlap-tint` (60%) toward white. Their letters are `muted` whatever the color, their ruler numbers `faint`, and their borders are drawn as usual.
- **Where the part begins**: one `print-overlap-line` (0.5 mm) `accent` line on that cell boundary, running the pad's full height (or width), through the rim and the rulers. A grayscale printer turns it into a mid-gray line, and the tint stays lighter than the beads around it.
- The overlap counts in the part's size, so a part with its overlap still fits its sheet.

## Header

- Line 1, baseline 16.4 mm: the technique word ("loom") in Instrument Serif italic 14 pt `accent`, then a 1.6 mm space, then the title (the Frame's name, else the Project's; ticket 0720) in Inter 600 13 pt `ink`.
- Line 2, the **part label**, baseline 21.4 mm, in DM Mono 7.5 pt `muted`: "part A · columns 1–75 · rows 1–100 · by {maker}". The range is the part's own, without the overlap. The maker is cut at 32 characters with an ellipsis, and " · by {maker}" is left out when the maker's name is empty.
- Right: the page number in Inter 600 18 pt `ink`, then 0.8 mm and "/ 9" in DM Mono 8 pt `muted`. Its right edge is on the right margin, baseline 18.6 mm.
- Left of the page number, 3 mm from it, with its top at 11.6 mm: the **mini map**. It shows the parts to scale in a 9.4 mm square, 0.4 mm apart, corners 0.3 mm. The current part is filled `accent`; the others are a 0.15 mm `faint` outline.
- No chart-style line and no date: the date is in the footer.

## Colors on this page

- The key starts 4 mm under the pad. The label "Colors on this page" is Inter 600 7 pt `ink`, baseline 6.3 mm under the pad.
- Then the colors on this page (overlap included), in Swatch letter order, reading across. They sit in `print-key-columns` (6) columns of 31.67 mm, rows 4.5 mm apart; the first row's top is 8 mm under the pad.
- Each color has a 3 mm swatch drawn like a bead on this page, whatever the chart's bead: its fill, a 0.1 mm `line-strong` edge, and its letter by the rule above (a round bead on a round-bead page). Then 1.6 mm, then the color name in Inter 400 7 pt `ink`, its baseline level with the letter's. No counts: the totals are in Beads needed on page 1.
- Nothing else goes under the board. There is no line on how to read the numbers: every row and column is numbered.

## Footer

- Baseline 285.4 mm. Left: the X1 mark (`bd-beads-mark-ink.svg`) at 3.6 mm with its top at 282.3 mm; 1.2 mm; "openbeads" in Inter 600 7.5 pt `ink`; 2 mm; the date and time in DM Mono 7.5 pt `muted` ("27 Oct 2026 · 14:05").
- Right, aligned to the right margin: "Continues right on page 3, below on page 4 →" or "Last part" (writing.md), in Inter 500 7.5 pt `ink`.

## Other bead shapes

The beads follow the canvas drawing (ticket 0585). The letters, rulers, key and tint are the same as for square beads.

- **Round beads**: a circle 2.6/3 of the bead across (2.6 mm on 3 mm), centred in its cell, filled, with a 0.1 mm `line-strong` edge so a White bead shows. There are no lines between the circles. An empty position draws only its cross, 40 % of the cell across.
- **Brick stitch**: every other row is offset by half a bead, as on the canvas. Each bead is bordered round its own cell, so nothing steps from row to row. Column numbers sit over the first row's beads. The rim runs straight, 1 mm clear of the outermost beads; a row set in by half a bead stands a little further inside it.
- **Peyote**: the same, with every other column offset half a bead down. Row numbers sit beside the first column's beads.
- **A Custom frame** (ticket 0594): the parts tile its bounding rectangle as for any Frame. Each bead is drawn at its centre, turned to its panel's angle, filled, with a 0.1 mm `line-strong` edge (round beads as circles), its letter upright at its centre; an empty position is outlined 0.1 mm `faint` so the shape reads, with its cross; the Seams are 0.18 mm `field-line` lines (`print-line-five`). A bead belongs to the part its centre falls in. The same rim goes round it. There are no cell lines and no rulers: its beads keep no rows and columns.

## Shared sheets

- Parts that fit together share a sheet in reading order, each on its own pad, 6 mm apart. Each pad gets its label 2 mm above it, in DM Mono 7.5 pt `muted` ("part B · columns 101–130 · rows 1–100"). The header's line 2 then names only the Project and the maker. The sheet has one key.

## Acceptance

A build agent checks each of these on a 100 × 100 loom Schema with an empty background, White beads and dark beads (the canvas mock), with Letters off:

- [ ] Chart pages are vector. The only image on a chart page is the text picture, and it lies under the drawing. Letters and numbers are text in `/Helvetica` or `/Helvetica-Bold`, not embedded fonts.
- [ ] The 100 × 100 is one part at 1.8 mm. A 150 × 100 is two parts of 75 columns at about 2.3 mm. The pad's top is at 25 mm.
- [ ] Every non-empty position has its letter in Helvetica-Bold, about 4.3 pt at 1.8 mm (6.5 pt at 3 mm), centred across, its baseline half its cap height below the cell's centre. No empty position has a letter or a fill; each carries the small `faint` cross.
- [ ] A bead with luminance > 0.1791 has an `ink` letter, otherwise white. A White bead has an `ink` letter.
- [ ] A two-letter Swatch letter is drawn at 72% horizontal scale and stays inside its cell.
- [ ] Each square bead's border is 0.1 mm `line-strong`, one hairline between neighbours; there is no line every 5th or 10th and no edge.
- [ ] The rim is a 0.2 mm `faint` outline with 2 mm corners and no fill, 1 mm clear of the outermost beads.
- [ ] Every row and column has its ruler number, upright, on all four sides, at the offsets above, all Helvetica `muted` in one size: 2.4 pt at 1.8 mm on the 100 × 100, 3.1 pt on part B of a 150 × 100.
- [ ] On part B of a 150 × 100, columns 74–75 are tinted 60% toward white, with `muted` letters and `faint` numbers, and a 0.5 mm `accent` line runs the pad's full height between columns 75 and 76.
- [ ] The header has the two lines, the page number and the mini map as above, and no chart-style or date line.
- [ ] "Colors on this page" shows this page's colors only, in 6 columns: the swatch with its letter, then the name, no counts. The key is the same height on every chart page of the PDF.
- [ ] The footer has the mark, "openbeads", and the date and time on the left, and the continuation on the right.
- [ ] Round, brick, peyote and Custom frame pages are drawn as "Other bead shapes" says, at 1.8 mm and at 9 mm.
- [ ] Printed in black and white, every letter is readable, empty positions are white under their cross, and overlap columns are lighter than their neighbours. Zoomed to 800 % on a Retina screen, letters and lines are sharp.

The earlier cards (1.75 mm, 2.3 mm and a fixed 3 mm cell, odd and even numbers turned upwards, counts in the key) are in git history.
