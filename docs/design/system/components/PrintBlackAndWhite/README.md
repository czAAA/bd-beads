# PrintBlackAndWhite

**Approved 2026-11-19, not yet in the app (ticket 1096).**

The PDF's chart and list pages drawn for a black-and-white printer, with the Export panel's **Black and white** switch on (off at first). It changes every page after the Cover page: Page 1, the list pages, the chart pages and the Word chart. The Cover page and the Picture stay in color.

It is a one-ink design, not the color pages turned grey. A 600 dpi office printer has only black toner: it prints solid black and bare paper sharply, and makes every grey out of dots. Drawn at a chart bead's size, a letter stays sharp on paper, on a light tint and on solid black, and breaks up on the greys between; a grey hairline comes out as a row of dots. Plain grey puts most colors exactly there. So this look uses paper, three light tints and solid black, and nothing between.

## One ink

- **All text and all lines are pure black** (`#000000`). What the color pages set in `muted` or `faint` is black here; weight and size carry the order instead (the rulers' tens bold, the fives regular).
- **Lines** keep their widths (`print-line-cell`, `print-line-five`, `print-line-ten`, `print-pad-line`) and are all black. (Approved 2026-11-19, not yet in the app, ticket 1126: the lines every 5 and 10 and the bold edge go, each bead keeps its own `print-line-cell` border in black, a solid black bead keeps its 0.2 mm of paper below in place of that border, and the thin ruler line, while Chart border is on, is black too. Ticket 1129: every ruler number is regular, the tens no longer bold.)
- **Nothing is accent**: the technique word, the lines where chart parts meet, the part labels, the mini map's current part (filled black) and the X1 mark (`bd-beads-mark-ink.svg`) are black.

## A bead's tone

Every bead on a chart keeps its Swatch letter (Helvetica-Bold, scaled with the bead as on the color pages) on one of five tones:

- **paper**, **10%**, **20%** or **30%** black (`print-tone-step`, up to `print-tone-max`), under a **black** letter;
- **solid black**, under a **white** letter.

The tones are given to the piece's own colors by how dark they are, so the picture stays readable in the chart:

- The colors are put in order of their grey (the app's grey of a color). **The order is kept**: a lighter color never prints darker than a darker one.
- The lightest tone is paper. With as many colors as tones or fewer, each color has its own tone, spread evenly from paper to the darkest. With more, the colors are cut into as many groups as there are tones, at the widest gaps in their grey; the colors of a group share its tone and are told apart by their letters, as always.
- **Solid black is for accents.** The darkest group prints solid black only when its colors are dark (their letter is white on the color pages) and together cover no more than `print-black-share` (25%) of the beads. Otherwise there is no black tone, and the darkest group takes the 30% tint. A piece with a large dark ground therefore prints as light tints, not as a sheet of toner.
- **A black bead stands apart**: the hairlines round it are left out and 0.2 mm of paper shows instead, so two black beads never run together.

An empty position is paper under the chart's small cross, drawn in black hairline. A bead on paper tone has its letter and its cell lines, which tells it from an empty position.

## The rest of the page

- **Overlap** columns and rows (PrintChartPage): their beads are paper with the letter in Helvetica (not bold), and the line where the part begins is black, `print-overlap-line` wide.
- **The overview** on Page 1 has no letters, so nothing can break up: each bead is its color's own grey, the board has no fill and a black hairline outline, and the lines where the parts meet are black with their white keyline.
- **Swatches** (Beads needed, "Colors on this page", the Word chart's key): the bead's tone with its letter, inside a black hairline, so a paper swatch still shows.
- Beads needed, the title block and the footer are as on the color pages, in black.

## Why these numbers

Measured on a simulated 600 dpi printer with a 106 lines-an-inch screen, at the smallest chart bead (1.8 mm, a 4.3 pt letter): a black letter is clean on paper, 10% and 20%, readable with a rough edge on 30%, and breaking up from 40%; a white letter is broken on 58% and 76% grey and clean on solid black. At 3 mm a bead the same holds one step later. The method: draw the beads with their letters at 600 dpi, turn every grey into round dots on a 106 lines-an-inch screen at 45°, leave solid black and paper as they are, and read the result enlarged. The canvas "PDF export: cover page" shows the look on a real piece.

## Acceptance

- [ ] With Black and white on, no page after the cover holds any color or any grey text or line.
- [ ] Every chart bead is paper, a 10%, 20% or 30% tint with a black letter, or solid black with a white letter.
- [ ] A lighter color never prints darker than a darker one.
- [ ] A piece whose darkest colors cover more than a quarter of the beads has no solid black beads.
- [ ] The Cover page and the Picture are in color.

Hand-written from the signed-off canvas; static rendition.
