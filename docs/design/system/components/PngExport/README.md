# PngExport

The PNG export: **the Cover page as a picture** (ticket 1096; PrintCover card), one A4 portrait page drawn by the same code as the PDF's Cover page: the technique word, the title, the maker, the piece's colors and the tech line at the top (ticket 1141), then the finished piece in color on the pale board.

**Trimmed to the beads** (ticket 1128): the picture shows only the rows and columns from the first bead to the last, across and down, empty positions between beads kept, and its tech line gives that trimmed size. A Schema with no beads shows whole.

- **One file, whatever the piece**: however big it is and however many colors it has, there are no list pages and no further files. Its footer reads "1 / 1".
- **Whatever the switches say**: it is saved whether or not the Cover page switch is on (that switch is the PDF's). Large beads, Row by row, Empty grid and Chart border change only the PDF (the Cover page has no chart and shows no empty positions, ticket 1127); the picture is always in color.
- The footer is the Cover page's (the mark, "openbeads" and the date and time on the left, the page number on the right).
- Drawn at 150, 300 or 450 dpi by the Export quality (QualitySlider card): 1240 × 1754, 2480 × 3508 or 3720 × 5262 px. A device that cannot hold a 450 dpi page draws High at 300. The PDF is not affected.
- Set in the print fonts (Inter, DM Mono, Instrument Serif), in the app's language. No wide layout, no watermark.
- File name `{project}-{frame}-{maker}.png` (ticket 0720, printed-output.md), with no switch's word in it (ExportPanel card).
- Once handed over, the one saved-file toast names it, "Saved to Downloads: {file}" or where else it went (Message card, tickets 0859, 1139), as for the PDF and the Project file. "Export" names the PNG and PDF only; the Project file is saved, never exported.

## Acceptance

- [x] Picture saves the Cover page as one PNG at the Export quality's dpi, with the Cover page switch on or off.
- [x] No list-page files follow it, and its size line says "1 file".
- [x] Its footer reads "1 / 1".

Rewritten in ticket 1096: from ticket 0915 until then the PNG was page 1 of the PDF as a picture (its chart painted from the PDF's drawing, the overview without the parts' lines and pills, list pages as further files `_2.png`, `_3.png`); before that it was the old Cover page (ticket 0583's tall picture, then the whole Schema on the board at up to 6 mm a bead). Those cards are in git history.
