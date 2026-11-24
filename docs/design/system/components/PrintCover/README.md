# PrintCover

**In the app since ticket 1096**: the PDF's first page and the page Picture saves.

The **Cover page**: one A4 portrait page that shows the finished piece in color, with its name. It is the PDF's first page while the Export panel's **Cover page** switch is on (it is on at first), and it is what **Picture** saves. It is the page a maker shows or sells the pattern with; the chart and Beads needed start on the page after it. Signed off on the canvas "PDF export: cover page", look A (Gallery).

## The page

Inside a 10 mm margin on all four sides (`print-margin`), top to bottom. The title block and the tech line open the page, over the piece, as Page 1 opens on its title block (ticket 1141; until then they were under the board):

- **The title block**, at the top margin, in two columns that share a bottom line.
  - Left: the technique word (Instrument Serif italic 18, `accent-strong`), the title (the Frame's name, else the Project's; Inter 700 39, `ink`, tracked −0.02 em, at most two lines, then an ellipsis) and "by {Maker's name}" (Instrument Serif italic 17, `muted`), 1.6 mm apart.
  - Right: the piece's colors as a row of plain squares (5 mm, rounded as a letter swatch is, 1.6 mm apart), the most used first, twelve at most; under it one line in DM Mono 8 `muted`, the Total's words: "6 colors · 1 104 beads · ≈ 5.6 g".
- **The tech line**, 5.8 mm under the title block: a 1.5 px `ink` rule across the page, then Page 1's tech line without the technique word (DM Mono 8, `muted`): "48×23 · Miyuki Delica 11/0 · ≈ 7.7 × 3.0 cm".
- **The board**, 9.5 mm under the tech line: as wide as the page inside its margins and `print-cover-board` (196 mm) tall, filled `print-board`, its corners rounded as the overview's board is. Nothing else is on it but the piece.
- **The piece**: the framed Schema trimmed to its beads (ticket 1128): the rows and columns from the first bead to the last, before it is scaled; a Schema with no beads whole. Drawn as the app draws it in the light theme, in color: no Swatch letters, no rulers, no lines every 5 and 10, no Row progress fade. Turned as its Canvas is turned, so a cuff lies across as it is woven. Scaled to fill the board inside `print-cover-pad` (8 mm) on every side, with no smallest and no largest bead, and centred. It casts one soft shadow on the board: 2.6 mm down, 3.7 mm of blur, `ink` at 16%. An empty position is bare board, with no cross: the cover is a picture, not a chart. The tech line gives the trimmed size.
- **The footer**, Page 1's: the X1 mark, "openbeads" and the date and time on the left, the page number on the right ("1 / 2"). **Changed on the Cover page only: see "The address" below** (approved 2026-11-24, not yet in the app, ticket 1233).

An empty name leaves out the title, an empty maker the "by" line. An unknown Bead shows no grams. No watermark: nothing is drawn over the piece.

## In the PDF

- The Cover page is the PDF's first page and counts as one: a piece that fitted one page is "1 / 2" and "2 / 2". Every page number after it moves on by one, and so does every page a page points at: the overview's pills ("part A · page 3") and a chart page's "Continues right on page 4".
- The Export panel's page count and File size estimate include it.
- It is a picture page at `print-dpi`, like the overview. The chart pages after it stay PDF drawing.
- The piece is drawn in the light theme's bead, its own-color rim and satin light (BeadBoard card), not the flat bead of the charts: the cover shows the piece as it looks, the charts are for reading.
- It is always in color, whatever **Black and white** says (PrintBlackAndWhite card).
- With the switch off the PDF opens on Page 1, as before.

## As the Picture

Picture saves (ticket 1096; PngExport card) this page as a PNG, at the Export quality's dpi (QualitySlider card), drawn by the same code as the PDF's. It is one file, whatever the piece's size and however many colors it has, and its footer reads "1 / 1". It is saved whether or not the Cover page switch is on: the switch is the PDF's. Its file name carries no option (ExportPanel card).

## The address: approved 2026-11-24, not yet in the app (ticket 1233)

Signed off by the owner on 2026-11-24 (ticket 1232, canvas "PDF cover page: where the openbeads.com URL goes", option F, "A + QR"). The Cover page, and only the Cover page, says where it was made, so anyone holding the file or a printout can find the app. Page 1, the chart pages and the list pages keep the footer above ("openbeads" and no address).

- **The footer grows** from one line (6 mm) to a block about 14 mm tall, 4 mm under the board. The board gives up the difference: `print-cover-board` falls from 196 mm to about 190 mm (the build ticket sets the exact value so the page still closes with the margin, and keeps `printPages.test.ts` in step).
- **Left, three lines**, 1.2 mm apart, left-aligned:
  1. the X1 mark (5 mm) and "Made with **openbeads.com**": "Made with" Inter 400 9 pt `muted`, the address Inter 600 9 pt `ink`, 2.5 mm after the mark;
  2. the tag: "Free bead pattern maker. No account." (Inter 400 7.5 pt `muted`);
  3. the date and time, as before (DM Mono 7 pt `muted`).
- **Right, a column** aligned to the page's right margin: the QR code with "scan to open" to its left (DM Mono 6.5 pt `muted`, right-aligned, 2 mm from the code), the page number under it (DM Mono 7 pt `muted`, as before), 1 mm apart.
- **The QR code** is 13 mm square, `ink` modules on the paper, with a quiet zone of four modules (the board's pale ground is not used). It encodes exactly `https://openbeads.com`: no path, no language, no tracking parameter. Drawn as vector squares in the PDF, as a picture in the PNG; always black on white, in Black and white too.
- **The address is a link in the PDF**: a link annotation over "openbeads.com" and over the QR code, both to `https://openbeads.com`. The PNG has no links.
- **Strings** (copy/print.md): "Made with" / "Сделано в"; the tag / "Бесплатный редактор схем для бисера. Без аккаунта."; "scan to open" / "наведите камеру". The address is never translated. The language is the app's, as the date's is.
- **Picture** (PNG) saves the same footer (PngExport card); its page number reads "1 / 1".
- Long cases: the date and time at its longest ("24 Nov 2026, 14:35") and a page number of "12 / 12" fit on one line each; the three lines never wrap (the left block is far narrower than the page minus the QR column).
- No watermark: the address is never on the board, the piece or the title block.

### Acceptance (address)

- [ ] The Cover page's footer reads "Made with openbeads.com", the tag, the date and time, a 13 mm QR code with "scan to open" and the page number.
- [ ] Scanning the QR code from a printout opens `https://openbeads.com`; in the PDF both the address and the code are links.
- [ ] Page 1, chart pages and list pages are unchanged; the Cover page still closes inside its margins with the shorter board.
- [ ] Picture saves the same footer; Black and white leaves it as it is.

## Acceptance

- [x] With Cover page on, the PDF opens on the cover: the piece in color on the board, its technique word, title, maker, colors and tech line; the chart starts on the next page.
- [x] Every page number and every page a page points at counts the cover.
- [x] With Cover page off, the PDF is what it was before.
- [x] Picture saves the cover as one PNG file.
- [x] The cover is in color with Black and white on.

Hand-written from the signed-off canvas; static rendition.
