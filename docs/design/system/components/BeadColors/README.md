# BeadColors

The Color catalog of the Project's Bead, to add a maker's color to the Palette (ticket 537, ADR 0072).

- **Entry**: a small `in-box` button "Bead colors" with a chevron under the Palette grid in the colour popover, shown only when the Bead has a Color catalog and not in Edit palette. It opens the list under the grid and a second press closes it.
- **Notes** (`Note`, always visible): colors are approximate because makers publish no hex, and a color that comes out the same as one in the Palette cannot be added twice.
- **Search**: one text field filters by code or color family.
- **Rows**: a swatch (`field-height` square, `line-strong` border, dashed while the hex is generated), the maker's code in `control`, and below it family and Finish in `meta` / `muted`, with "Discontinued" appended for such a code. Only the codes that exist in the Bead's size are listed; the list scrolls and shows the first 60 matches.
- **Taken**: a row whose hex the Palette already holds is `muted`, `aria-disabled`, and says "In the Palette" on the right.
- A press adds the color as an added swatch; the list stays open.

Hand-written from ticket 537; the Vue component `BeadColorList.vue` is the real thing.
