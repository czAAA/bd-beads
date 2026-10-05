# 297: The Zoom pill can be moved

**What to build:** The Zoom pill has a drag handle at one end. Dragging it moves the pill anywhere inside the canvas box, clamped to stay fully inside; on release it snaps to the nearest corner. The position is kept on the device like Rulers and theme, and applies wherever the pill shows (every width under 1024px). It never covers the Dock, and the Frame bar and Selection context bar keep clear of it. Add the handle and the dragged state to the ZoomPill card (DESIGN.md §6).

**Blocked by:** 296

**Human involvement:** interactive

**Status:** done (real-phone drag, rotate and Frame bar clearance check left for a human; the `preview.html` pages were removed in this change)

- [x] The handle has an accessible name and a Tooltip, and a drag by touch or mouse moves the pill without drawing or panning
- [x] The pill stays inside the canvas box at every width and after rotating the device or resizing, and the saved corner is restored on reload
- [x] The snap uses the nearest corner and respects `prefers-reduced-motion`
- [x] The pill cannot be dragged over the Dock, and the pill's other buttons still work after a move
