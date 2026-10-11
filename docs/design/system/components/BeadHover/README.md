# BeadHover

How the Pattern answers the pointer: outline or colour preview on hover, and the cursors.

- No colour chosen: hovering a bead draws the 2px `bead-outline` inside it. With Paint and a colour: the bead previews that colour at 60%. Touch has no hover: the bead changes on contact.
- Bead pointer (ticket 353): over the board's beads the OS pointer is hidden and a bead-shaped marker stands in for it, for a mouse and a hovering pen alike (a pen has no CSS cursor). It is 90% of a bead as drawn, so it follows zoom, centred on the pointer (it does not snap to the bead under it), rounded in peyote and square otherwise, and looks like the hover preview: the chosen colour at 60%, else the 2px `bead-outline`. A pen lifting away or leaving the board drops it; a finger has none.
- Other cursors: not-allowed over the Frame's margin; grab while Space is held; grabbing while panning or moving a picture in Convert image.
- Painting is instant: no animation on a bead taking its colour.

Hand-written from the Phase B sign-off.
