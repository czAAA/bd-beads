# 107: Overlay layer on the renderer

**What to build:** With the temporary switch on (ticket 105), everything that comes and goes with the pointer or a tool is drawn on the Drawing surface's overlay layer, so it never forces the cells to be redrawn: the Select tool's marquee and its highlight over the selected beads, the paste preview under the cursor, Mirror's axis lines, and the dimmed beads shown while hovering a "Mirror current" button. Together with 106 this brings the renderer path to full parity with the DOM grid; after this nothing the DOM grid does is missing.

The marquee stays one outlined rectangle even across peyote's shifted rows, the axis lines follow the Pattern as it is rotated, and each overlay looks like it does today.

**Blocked by:** 106 (Pointer interaction and hover preview on the renderer)

**Status:** ready-for-agent

- [ ] The Selection is drawn as today: a highlight over its beads and an outline that reads as one rectangle on loom, peyote and brick stitch
- [ ] The paste preview draws the copied block under the cursor in its real colors, honouring Mirror as today
- [ ] Mirror axis lines are drawn whenever a direction's count is above 0, in the right place at every zoom, and follow rotation
- [ ] Hovering a "Mirror current" button dims exactly the beads clicking it would overwrite, and nothing else
- [ ] Changing an overlay repaints only the overlay layer, not the cells; a Selection drag and a paste hover hold the floor target (at least 30 fps at 4× CPU slowdown) at 70×250 and 250×250, with the numbers recorded in this ticket
- [ ] Screenshots with the switch on match ticket 103's reference screenshots for Selection, paste preview and Mirror axes within tolerance
- [ ] Each overlay has a test on the renderer path; no behaviour is left covered only by a DOM-grid test
