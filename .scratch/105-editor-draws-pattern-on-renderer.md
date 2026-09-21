# 105: Editor draws the Pattern on the renderer

**What to build:** Opening a Pattern shows it drawn by the Pattern renderer on a **Drawing surface**, instead of one DOM element per bead, still with the same rulers, zoom, rotation and scrolling. This is the "expand" step: the new drawing path is added beside the old DOM grid behind a **temporary development switch**, and the DOM grid stays the default until ticket 108. The switch is never a user-facing setting and is deleted in ticket 111 (ADR 0006 retired an earlier flag on the same reasoning: rolling back costs no more than a revert).

The Drawing surface is sized to the visible region and redrawn on scroll and zoom, inside the scroll containers and zoom box the canvas panel already has (ADR 0018). The native horizontal scroll of the canvas panel, the page's own vertical scroll, Space-drag pan, the zoom cluster and the four rulers keep working exactly as now.

This ticket covers looking at a Pattern. Painting and every pointer tool arrive in 106, the overlays in 107.

**Blocked by:** 67 (Pattern renderer)

**Status:** ready-for-agent

- [ ] With the switch on, an open Pattern is drawn by the renderer for loom, peyote and brick stitch, with the rulers, zoom, rotation and Space-drag pan behaving exactly as with the DOM grid
- [ ] Row progress is drawn: finished rows dimmed, the current row (or, in the column direction, column) outlined, and the marker's look matches the DOM grid's
- [ ] Scrolling and zooming redraw only what is in view; drawing cost does not grow with the Pattern's size
- [ ] Opening a Pattern paints in about 200 ms at 70×250 on the floor (4× slowdown), and scrolling and zooming stay at 30 fps there; the numbers from ticket 103's performance check are recorded in this ticket
- [ ] Screenshots with the switch on match ticket 103's reference screenshots (all fixtures with Row progress, all zooms, rotated) within tolerance
- [ ] With the switch off (the default) the app behaves exactly as before
- [ ] Tests cover the switch on: viewport selection, zoom, rotation and Row progress, at the domain level or against the renderer
