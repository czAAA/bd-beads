# PrintPage1

**Page 1** of the PDF (ticket 0914): the title block, the whole piece and one Beads needed table, on one A4 portrait page inside a 10 mm margin on all four sides (`print-margin`). For most pieces it is the whole PDF.

- Top to bottom: the Frame's name as the title, else the Project's (Inter 700 22, `ink`; left out when both are empty), "by {Maker's name}" under it (Instrument Serif italic 13, `muted`; left out when empty), one tech line (DM Mono `muted`: technique, grid, Bead, Estimated size), the whole piece, Beads needed 4 mm under its rulers, the footer. The Bead's name is never the title.
- **The chart, when it fits page 1** at a working bead (planPrint, ticket 0913): drawn exactly as a chart page draws a part (PrintChartPage: PDF drawing, a letter on every bead, rulers on all four sides, lines every 5 and 10, the pad outline), at the bead the room under the title block allows, up to `print-bead-max` (9 mm) and down to `print-bead-stretch` (1.6 mm). A 20 × 20 fills the page width at 9 mm, a 5 × 5 is centred at 9 mm, a 100 × 100 is 1.8 mm. A long narrow piece is folded into strips side by side, each under its label (PrintStrips). Nothing follows but list pages and the Word chart: a 20 × 20 or a 100 × 100 is one page.
- **The room the chart gets**: all of Beads needed is kept under it when the table takes no more than 40% of the room under the title block; otherwise only its heading and first row are, the chart takes the rest, and the colors that do not fit under it continue on list pages.
- **The overview, when it does not fit**: the whole piece on the board (`print-board`), scaled to its room with no minimum bead, without letters, rulers with a number every 5 (10 when the beads are small) and a hairline every 10, an empty position bare board under a small `faint` cross. The chart parts are marked on it: solid 2 px `accent` lines with a white keyline through the board and its rulers, "101 →" / "101 ↓" in `accent-strong` at each cut, and a white pill on each part with its page ("part A · page 2"). The parts follow on chart pages.
- **Beads needed**, one table printed once: "Beads needed" (Inter 600 8.5) over a 1.5 px `ink` rule; two columns 8 mm apart that read down, each with its heads (DM Mono 6.5 `muted`, lower case: color, code, beads, grams, to buy) and rows 5 mm tall on `line` hairlines: a 3.6 mm letter swatch (the color with its Swatch letter, as on every chart), the color name (Inter 7.5), the brand code (DM Mono 7 `muted`), beads, grams and to buy (DM Mono 7, right-aligned). Under a 1.5 px `ink` rule the Total: "Total · 8 colors" (Inter 700 8) on the left, "10 000 beads · ≈ 50 g · 15 × 5 g" (DM Mono 500 7.5) on the right; then the grams note (Inter 6.5 `muted`). An unknown Bead shows no grams, no tubes and no note; no paint shows "Nothing painted yet".
- **To buy**: 5 g tubes from the grams with about 10% spare, rounded up ("2 × 5 g"); the Total adds up the tubes.
- **List pages**: the colors that do not fit page 1 continue on pages straight after it (so chart pages start later), each with the title (Inter 700 13) over the same table; the Total and the note end the last.
- **Footer**, on page 1 and the list pages: the X1 mark, "openbeads" and the date and time on the left, the page number on the right in DM Mono `muted` ("1 / 1", "2 / 3"), counting the list pages, the chart pages and the Word chart.
- No watermark: nothing behind or over the chart, the title or Beads needed.

## Acceptance

- [ ] A 20 × 20 and a 100 × 100 with Letters off export one page: the chart lettered and numbered, Beads needed under it, "1 / 1".
- [ ] A 150 × 100 opens with the overview, its two parts marked, then two chart pages: "1 / 3".
- [ ] Colors that do not fit page 1 continue on a list page; the Total and the note end the last.

Rewritten in ticket 0914: the Cover page that opened the PDF (the whole Schema at up to 6 mm a bead, the parts marked, Beads needed as swatch, name, beads and grams) and the Specification page after the chart pages are folded into this page. Since ticket 0915 the PNG is this page as a picture (PngExport); the earlier cards are in git history.
