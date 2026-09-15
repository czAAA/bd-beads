# 24: Drag-to-draw with the Paint tool

**What to build:** Clicking and dragging with the Paint tool paints every cell the cursor passes over, not just the initial click, so a stroke draws a continuous line.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Pressing the mouse button down on a cell with the Paint tool paints it, same as today
- [ ] Dragging while the button is held paints every cell the cursor moves over along the path, without needing repeated clicks
- [ ] Releasing the mouse button ends the stroke
- [ ] The whole dragged stroke is one undo step, not one step per cell
- [ ] The Fill tool is unaffected — it remains click-only
- [ ] When mirror is on, dragging also live-mirrors each cell along the path (per ticket 22)
