# PrintCover

**Approved 2026-11-19, not yet in the app (ticket 1096).** Until that ticket lands the PDF opens on Page 1 (PrintPage1) and the Picture export is Page 1 as a picture (PngExport).

The **Cover page**: one A4 portrait page that shows the finished piece in color, with its name. It is the PDF's first page while the Export panel's **Cover page** switch is on (it is on at first), and it is what **Picture** saves. It is the page a maker shows or sells the pattern with; the chart and Beads needed start on the page after it. Signed off on the canvas "PDF export: cover page", look A (Gallery).

## The page

Inside a 10 mm margin on all four sides (`print-margin`), top to bottom:

- **The board**: as wide as the page inside its margins and `print-cover-board` (196 mm) tall, filled `print-board`, its corners rounded as the overview's board is. Nothing else is on it but the piece.
- **The piece**: the whole framed Schema, drawn as the app draws it in the light theme, in color: no Swatch letters, no rulers, no lines every 5 and 10, no Row progress fade. Turned as its Canvas is turned, so a cuff lies across as it is woven. Scaled to fill the board inside `print-cover-pad` (8 mm) on every side, with no smallest and no largest bead, and centred. It casts one soft shadow on the board: 2.6 mm down, 3.7 mm of blur, `ink` at 16%. An empty position is bare board, with no cross: the cover is a picture, not a chart. (Approved 2026-11-19, not yet in the app, ticket 1128: the piece is trimmed to its beads, the rows and columns from the first bead to the last, before it is scaled, and the tech line gives the trimmed size.)
- **The title block**, 9.5 mm under the board, in two columns that share a bottom line.
  - Left: the technique word (Instrument Serif italic 18, `accent-strong`), the title (the Frame's name, else the Project's; Inter 700 39, `ink`, tracked −0.02 em, at most two lines, then an ellipsis) and "by {Maker's name}" (Instrument Serif italic 17, `muted`), 1.6 mm apart.
  - Right: the piece's colors as a row of plain squares (5 mm, rounded as a letter swatch is, 1.6 mm apart), the most used first, twelve at most; under it one line in DM Mono 8 `muted`, the Total's words: "6 colors · 1 104 beads · ≈ 5.6 g".
- **The tech line**, 5.8 mm under the title block: a 1.5 px `ink` rule across the page, then Page 1's tech line without the technique word (DM Mono 8, `muted`): "48×23 · Miyuki Delica 11/0 · ≈ 7.7 × 3.0 cm".
- **The footer**, Page 1's: the X1 mark, "openbeads" and the date and time on the left, the page number on the right ("1 / 2").

An empty name leaves out the title, an empty maker the "by" line. An unknown Bead shows no grams. No watermark: nothing is drawn over the piece.

## In the PDF

- The Cover page is the PDF's first page and counts as one: a piece that fitted one page is "1 / 2" and "2 / 2". Every page number after it moves on by one, and so does every page a page points at: the overview's pills ("part A · page 3") and a chart page's "Continues right on page 4".
- The Export panel's page count and File size estimate include it.
- It is a picture page at `print-dpi`, like the overview. The chart pages after it stay PDF drawing.
- It is always in color, whatever **Black and white** says (PrintBlackAndWhite card).
- With the switch off the PDF opens on Page 1, as before.

## As the Picture

Picture saves this page as a PNG, at the Export quality's dpi (QualitySlider card), drawn by the same code as the PDF's. It is one file, whatever the piece's size and however many colors it has, and its footer reads "1 / 1". It is saved whether or not the Cover page switch is on: the switch is the PDF's. Its file name carries no option (ExportPanel card).

## Acceptance

- [ ] With Cover page on, the PDF opens on the cover: the piece in color on the board, its technique word, title, maker, colors and tech line; the chart starts on the next page.
- [ ] Every page number and every page a page points at counts the cover.
- [ ] With Cover page off, the PDF is what it was before.
- [ ] Picture saves the cover as one PNG file.
- [ ] The cover is in color with Black and white on.

Hand-written from the signed-off canvas; static rendition.
