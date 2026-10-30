# PrintPage1

The **Cover page**: the first page of the PDF and the whole of the PNG (PngExport card), one A4 portrait page inside a 10 mm margin on all four sides (`print-margin`), drawn by the same code for both.

- Top to bottom: the Frame's name as the title, else the Project's (Inter 700 22, `ink`; left out when both are empty), "by {Maker's name}" under it (Instrument Serif italic 13, `muted`; left out when empty), one tech line (DM Mono `muted`: technique, Bead, grid, Estimated size), the framed Schema, Beads needed, the footer. The Bead's name is never the title.
- The board (`print-board`): every bead, rulers on all four sides with a number every 5 (10 when the beads are small) and a hairline every 10. A small Schema's bead is capped at `print-bead-max` (6 mm) and the picture is centred in the room it has, Beads needed moving up under it at an even gap (8 mm); a big Schema is scaled down to fit, with no minimum bead size; a wide flat one fits the page width. An empty position shows the board with a small `faint` cross when the beads carry no letters (Letters off), and the bare board when they do (PngExport card, ticket 0719).
- The chart parts, in the PDF only: solid 2 px `accent` lines with a white keyline through the board and its rulers, "101 →" / "101 ↓" in `accent-strong` at each cut, and a white pill on each part with its page ("part A · page 2").
- Beads needed under the board, two columns reading down: letter swatch, color name, beads, grams; then the Total and the grams note. It takes at most 40% of the room under the title block; colors that do not fit continue on list pages (the name, small, over the same two columns, the Total on the last), PDF pages right after the cover and PNG files `_2`, `_3`.
- Footer: the X1 mark and "openbeads" on the left, date and time on the right.
- No watermark: nothing behind or over the board, the title or Beads needed.

Rewritten in ticket 0583 (the facts row, the "see page N" line and the page number are gone, the title block replaces them); the earlier card (a row of facts above the board, one line pointing at the Specification page) is in git history.
