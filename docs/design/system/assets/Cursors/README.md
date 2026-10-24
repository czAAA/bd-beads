# Cursors

The Tool pointers: the canvas pointer for each tool (ticket 0542), so the pointer itself says which tool is in use. Seven single files, 24 × 24 on the icon grid, drawn from the tool's own icon but lighter, because a cursor sits over the painting and must not compete with it:

- **Ink** `ink` #1f1f1f at 1.4 (the icons' 1.75 is too heavy at pointer size), round caps and joins.
- **Halo** white at 90%, 1.6 wider than the ink (0.8 each side), so the cursor reads over any bead colour and on the dark canvas.
- **Body** white at 55%, a frosted fill, so the beads under it still show faintly.
- **Colour bead** (Paint and Fill): a bead with 22% corners, 6 units square, filled with the current colour and **no border**; only a thin halo (1.5, white at 90%) keeps it apart from a bead of the same colour under it. In the file it is the `rect.bead` with `fill="currentColor"`: the app writes the colour in, and leaves the bead out when no colour is chosen.
- A cursor image can't read CSS custom properties, so the ink and white are fixed in the files, as with the eyedropper cursor (ticket 0403). The same files serve every theme.

| File | Tool | Drawing | Hot spot (x, y) |
|---|---|---|---|
| `paint.svg` | Paint | the `paint` pencil at 72%, its tip touching the colour bead | 5, 19 (the bead's centre) |
| `erase.svg` | Erase | the `erase` eraser without its floor line | 6, 17 (the middle of its working edge) |
| `hand.svg` | Hand | the `hand` icon, open | 11, 12 |
| `hand-grabbing.svg` | Hand, while dragging | the same hand with the fingers curled | 11, 12 |
| `select.svg` | Select | the system's arrow, white with an ink outline (1.2) | 4, 3 (the tip) |
| `fill.svg` | Fill | the `fill` bucket at 78% without its drop; the colour bead is the drop | 18, 18 (the bead's centre) |
| `piece.svg` | Select a piece | the `piece` polygon of beads at 2 and 2.8, with a bead in the middle | 12, 12 (the middle bead) |

The CSS value is the image, its hot spot and the system cursor as fallback: `url(paint.svg) 5 19, crosshair`, `url(hand.svg) 11 12, grab`, `url(hand-grabbing.svg) 11 12, grabbing`, `url(select.svg) 4 3, default`.

**A hovering Pencil** (ticket 546): Safari draws no CSS cursor for an Apple Pencil, so the app draws the same file itself, an image placed so its hot spot is at the Pencil's tip, with the same colour bead. Hover only: it is hidden while the Pencil touches the screen, when it lifts away or is cancelled, and when it leaves the board. It follows the same rule as the CSS cursor for which tool shows (in Mouse mode the Pencil moves the canvas, so it shows `hand.svg`), plus the eyedropper's cursor (ticket 0403). Not drawn over the Frame's margin (not-allowed) or in Set Frame: the Pencil shows nothing there. A mouse or trackpad keeps the CSS cursor only. Only hover-capable iPads (M2 iPad Pro or later, with Pencil 2 or Pencil Pro) send pen hover. The size and weight are those for a mouse; if they read too small or light at Pencil distance, this is the place to change them.

Don't thicken the ink or the halo, add a border to the colour bead, use a drop shadow (it darkens the bead the cursor points at), or scale a cursor past 24px except for the device's pixel ratio.
