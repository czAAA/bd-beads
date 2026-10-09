# 353: The pointer over the board is a bead-shaped marker, 90% of a bead

**What to build:** over the beads of an open Project, the pointer is a small bead-shaped marker instead of the crosshair, on every platform and for every hovering input: a mouse on Mac, Linux and Windows, and a hovering pen (Apple Pencil on iPad, other styluses), whose projected point today looks like a cross.

- The marker is centred on the pointer (free-floating, it does not snap to the bead under it).
- Its size is 90% of a bead as drawn on screen, so it follows zoom and matches the beads at every zoom level.
- Its shape follows the Technique's bead, as the hover preview does (a rounded bead in peyote, square otherwise).
- It looks like the hover preview: the chosen color at 60% when Paint has a color, otherwise the 2px dark `bead-outline`.
- The existing hover preview on the bead under the pointer stays.
- The other pointers stay as they are: not-allowed over the Frame's margin, grab for the Hand tool and Space + drag (closed while moving the canvas), and the Set Frame cursor.
- A hovering pen shows the marker and loses it when the pen lifts away or leaves the board. Finger touch has no hover and shows none.
- It works in both input modes (Pen mode and Mouse mode).

Open to the implementer: whether this is a generated CSS cursor image per zoom (limited in size, and no use for a pen, which has no CSS cursor) or a marker drawn on the overlay layer with the OS pointer hidden. Pick the one that works for the mouse and the pen alike. Update the BeadHover card in `docs/design/system/` (its cursor line says crosshair), CONTEXT.md, and the design system's changelog line, in the same change.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Mouse over the beads on desktop shows the bead-shaped marker, not a crosshair
- [x] The marker is 90% of the on-screen bead size at several zoom levels, and centred on the pointer
- [x] The marker's shape follows the Technique (rounded in peyote) and its fill follows the hover preview rules (color at 60%, else dark outline)
- [x] A hovering pen shows the same marker and drops it when the pen lifts away or leaves; finger touch shows none
- [x] Not-allowed (Frame margin), grab (Hand, Space), and the Set Frame cursors are unchanged
- [x] BeadHover card, CONTEXT.md and the design system changelog are updated; tests and the visual check cover the marker
