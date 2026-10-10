# 377: The rulers look the same at every zoom, and a piece of five beads has them

**What to build:** the rulers' dots, numbers and lines were fixed pixel sizes, so zoomed out the dots and the white line stood far from a small piece and the numbers were small, and zoomed in the numbers sat tight on the line and the dots were barely visible. Their parts now follow the zoom (a size at 100% and a clamp at each end), and a Piece area has rulers once it has more than 4 beads in total.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A Piece area carries rulers when its rectangle spans more than 4 beads (width times height), not only from 3x3
- [x] Zoomed out, the Frame's line and a piece's rectangle sit closer to the beads, and the dots with them
- [x] Zoomed out, the numbers are bigger and readable
- [x] Zoomed in, the numbers are bigger, with a wider gap to the line, and the dots are bigger
- [x] The Frame's handles follow the line's outset
- [x] Rulers card, README changelog and CONTEXT.md say so
- [x] The ticket is archived in the same change

Left out: the thresholds themselves (Ruler step, last number only below 50%) are unchanged.
