# 373: Finished rows come back to full color only while the pointer is over a finished row

**What to build:** Ticket 352 had finished rows return to their normal color while a mouse or Pencil hovered anywhere over the canvas, which made them bright from almost any point on the open canvas. They now return only while the pointer is over a finished row (or column, for column-wise Row progress). Empty open canvas, the margin, rows still to weave and the space off the canvas keep them dimmed.

Cause: `hovered` in `ProjectSurface.vue` was set to "not a touch" on every pointer move, whatever was under the pointer. It is now set from the bead under the pointer, with `isInFinishedRow`.

Known limits: each flip between bright and dimmed redraws the whole surface (once per frame), so moving the pointer across the finished/current boundary on a very large Pattern costs a few full redraws. Hovering the seam between a woven and an unwoven peyote half is not special-cased. The tap on a finished row, which toggles finished rows on a touch screen, is unchanged.

**Spec:** 352

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Hovering a finished row with a mouse or an Apple Pencil draws every finished row at normal color
- [x] Moving to empty canvas, the margin, a row still to weave, or off the canvas dims them again
- [x] The same holds for column-wise Row progress
- [x] A pointer that does not move is asked again when the canvas scrolls or zooms, or the weaver's row changes (Undo, the Progress bar)
- [x] A pan does not change the hover
- [x] The BeadBoard card, `CONTEXT.md`, the design system changelog and ticket 352 say "over a finished row"
- [x] The ticket is archived in the same change

Left out: tests for peyote half-rows and rotated Projects (the check is the same `isInFinishedRow` the lock uses, which has its own tests); the redraw cost above.
