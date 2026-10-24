# BeadHover

How the Pattern answers the pointer: outline or colour preview on hover, and the cursors.

- No colour chosen: hovering a bead draws the 2px `bead-outline` inside it. With Paint and a colour: the bead previews that colour at 60%. Touch has no hover: the bead changes on contact.
- Bead pointer (ticket 353): over the board's beads the OS pointer is hidden and a bead-shaped marker stands in for it, for a mouse. It is 90% of a bead as drawn less 1px, so it follows zoom, centred on the pointer (it does not snap to the bead under it), rounded in peyote and square otherwise, and looks like the hover preview: the chosen colour at 60%, else the 2px `bead-outline`. The preview fills only its bead, in the bead's own shape, and on peyote leaves out the part the next row's beads lie over. A finger has none, and a hovering pen has the Tool pointer below.
- Tool pointer (ticket 0542): over the canvas the pointer is the active tool's drawing from `assets/Cursors/` (Paint, Erase, Hand, Select, Fill, Select a piece), with the current colour in the Paint and Fill bead; Hand shows `hand-grabbing` while it pans. It takes the place of the bead pointer above: the OS pointer stays and the bead marker is not drawn, since the colour bead of Paint and Fill is the marker (its hot spot is the bead's centre); the hover preview on the bead underneath is unchanged. A hovering Apple Pencil gets no CSS cursor from Safari, so the app draws the tool's pointer itself at the Pencil (ticket 546): hot spot on the tip, hover only (hidden while the Pencil touches, when it lifts away or is cancelled, and when it leaves the board), only for a pointer that draws with the tool (in Mouse mode the Pencil shows the Hand's open hand), the eyedropper's pointer too, and nothing over the Frame's margin or in Set Frame.
- Other cursors: not-allowed over the Frame's margin; the system's grab while Space is held; grabbing while Space + drag or the right mouse button pans, and while moving a picture in Convert image.
- Painting is instant: no animation on a bead taking its colour.

Hand-written from the Phase B sign-off.
