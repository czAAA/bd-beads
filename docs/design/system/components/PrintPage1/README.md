# PrintPage1

**Page 1** of the PDF (ticket 0914): the title block, the whole piece and one Beads needed table, on one A4 portrait page inside a 10 mm margin on all four sides (`print-margin`). For most pieces it is the whole PDF after the Cover page.

- **It follows the Cover page** (ticket 1096). With the Export panel's Cover page switch on (it is on at first) the PDF opens on the Cover page (PrintCover card) and this page is the second: its footer reads "2 / 2", and the pages its overview points at are one later ("part A · page 3"). The name Page 1 stays: it is the chart's first page. With the switch off it is the PDF's first page, as it was.

- Top to bottom: the Frame's name as the title, else the Project's (Inter 700 22, `ink`; left out when both are empty), "by {Maker's name}" under it (Instrument Serif italic 13, `muted`; left out when empty), one tech line (DM Mono `muted`: technique, grid, Bead, Estimated size), the whole piece, Beads needed 4 mm under its rulers, the footer. The Bead's name is never the title.
- **The chart, when it fits page 1** at a working bead (planPrint, ticket 0913): drawn exactly as a chart page draws a part (PrintChartPage: PDF drawing, a letter on every bead, rulers on all four sides, lines every 5 and 10, the pad outline), at the bead the room under the title block allows, up to `print-bead-max` (9 mm) and down to `print-bead-stretch` (1.6 mm). A 20 × 20 fills the page width at 9 mm, a 5 × 5 is centred at 9 mm, a 100 × 100 is 1.8 mm. A long narrow piece is folded into strips side by side, each under its label (PrintStrips). Nothing follows but list pages and the Word chart: a 20 × 20 or a 100 × 100 is one page.
- **The room the chart gets**: all of Beads needed is kept under it when the table takes no more than 40% of the room under the title block; otherwise only its heading and first row are, the chart takes the rest, and the colors that do not fit under it continue on list pages.
- **The overview, when it does not fit**: the whole piece on the board (`print-board`), scaled to its room with no minimum bead, without letters, rulers with a number every 5 (10 when the beads are small) and a hairline every 10, an empty position bare board under a small `faint` cross. The chart parts are marked on it: solid 2 px `accent` lines with a white keyline through the board and its rulers, "101 →" / "101 ↓" in `accent-strong` at each cut, and a white pill on each part with its page ("part A · page 2"). The parts follow on chart pages.
- **Beads needed**, one table printed once (ticket 1096): "Beads needed · Miyuki Delica 11/0" (Inter 600 8.5, the Bead's name with its size in Inter 500 at the same size; an unknown Bead leaves the name out) over a 1.5 px `ink` rule; then the heads (DM Mono 6.5 `muted`, lower case: color, code, beads, grams) and rows 5 mm tall on `line` hairlines: a 3.6 mm letter swatch (the color with its Swatch letter, as on every chart), the color name (Inter 7.5), the brand code (DM Mono 7 `muted`), beads and grams (DM Mono 7, right-aligned, grams at the table's right edge). **One color to a row**, the table as wide as the page, when all the colors fit under the chart that way; otherwise two columns 8 mm apart that read down, each with its heads, and what still does not fit goes to list pages, in two columns too. The room the chart gets is worked out from the table in two columns, so the chart is never smaller for it. Under a 1.5 px `ink` rule the Total: "Total · 8 colors" (Inter 700 8) on the left, "10 000 beads · ≈ 50 g" (DM Mono 500 7.5) on the right; then the grams note (Inter 6.5 `muted`), which keeps its advice to buy about 10% more. There is no to buy column and no tubes. An unknown Bead shows no grams and no note; no paint shows "Nothing painted yet". When the Schema has empty positions, the heading row ends at the right with the key's one item for them (ticket 0963): a 3 mm empty swatch carrying the chart's small `faint` cross (PrintWordChart's key item), 1.6 mm, then "empty" (Inter 7.5 `ink`), on page 1 only and in the PNG alike; a Schema with none has no such item.
- **List pages**: the colors that do not fit page 1 continue on pages straight after it (so chart pages start later), each with the title (Inter 700 13) over the same table in two columns, its heading naming the Bead too; the Total and the note end the last.
- **Footer**, on page 1 and the list pages: the X1 mark, "openbeads" and the date and time on the left, the page number on the right in DM Mono `muted` ("1 / 1", "2 / 3"), counting the Cover page, the list pages, the chart pages and the Word chart.
- No watermark: nothing behind or over the chart, the title or Beads needed.

## Approved 2026-11-19, not yet in the app (ticket 1096)

Until ticket 1096 lands this page is as written above. Then:

- With Black and white on, this page is drawn in one ink (PrintBlackAndWhite card).

## Acceptance

- [ ] A 20 × 20 and a 100 × 100 with Letters off export one page: the chart lettered and numbered, Beads needed under it, "1 / 1".
- [ ] A 150 × 100 opens with the overview, its two parts marked, then two chart pages: "1 / 3".
- [ ] Colors that do not fit page 1 continue on a list page; the Total and the note end the last.

Rewritten in ticket 0914: the Cover page that opened the PDF (the whole Schema at up to 6 mm a bead, the parts marked, Beads needed as swatch, name, beads and grams) and the Specification page after the chart pages are folded into this page. Since ticket 0915 the PNG is this page as a picture (PngExport); the earlier cards are in git history.
