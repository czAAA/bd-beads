# 106: Pointer interaction and hover preview on the renderer

**What to build:** With the temporary switch on (ticket 105), every pointer tool works on the Drawing surface: a click or touch lands on the bead under the pointer, worked out from where it is on the surface and the current zoom, rotation, technique stagger and scroll, rather than from per-bead elements. Paint (dragging a stroke), right-click erase, Fill, the Erase tool and the Select drag all behave exactly as they do on the DOM grid, with mouse, touch and pen. Hovering shows the preview of where paint will land, including its live-mirror counterparts; moving the pointer costs a repaint of a handful of beads, not of the whole grid.

Behaviour that must not change: the Row progress lock (finished rows are never touched), Mirror while painting, Space-drag pan taking precedence over painting, a dragged stroke being one undo step and saving once when it ends (ADR 0012), and a touch or pen stroke not scrolling the page while drawing. Undo, Redo and every keyboard shortcut keep working.

The Selection marquee, paste preview, Mirror axis lines and "Mirror current" dimming are 107.

**Blocked by:** 105 (Editor draws the Pattern on the renderer)

**Status:** ready-for-agent

- [ ] With the switch on, Paint, right-click erase, Fill, the Erase tool and the Select drag work with mouse, touch and pen, on loom, peyote and brick stitch, at every zoom and rotated
- [ ] Which bead a point lands on is correct across peyote's and brick stitch's staggered rows and tighter row packing, on the bead's edge, in the gap between beads, and outside the grid
- [ ] The hover preview shows the paint color (or the neutral outline with no color selected) on the hovered bead and its live-mirror counterparts, and a pasted block previews in its own colors
- [ ] Hovering and painting hold the floor target (at least 30 fps at 4× CPU slowdown) at 70×250 and at 250×250; the numbers from ticket 103's performance check are recorded in this ticket
- [ ] The Row progress lock, Mirror painting, Space-drag pan, one-undo-step-per-stroke and save-once-per-stroke behave exactly as with the DOM grid
- [ ] Every behaviour test that finds beads through DOM elements has an equivalent for the renderer path, at the domain, hit-test or pointer-event-at-coordinates level; hit-testing has its own unit tests including staggered rows
- [ ] With the switch off (the default) nothing changes
