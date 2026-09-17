# 35: New Pattern in the header, zoom controls floating on the canvas box

**What to build:** Two controls leave the row above the canvas, so the tool strip moves up to the top of the above-canvas panel.

- **New Pattern** becomes the first item in the header's aqua box, before the current-pattern summary and the language switcher. It works as it does today: it stays disabled while there are no saved Patterns and keeps the app's non-red button style.
- **Zoom controls** become a vertical stack floating inside the canvas box along its right edge, ordered top to bottom: +, zoom %, −, reset. The stack stays in place while the pattern is scrolled, zoomed or rotated. Pointer activity on it never reaches the grid: clicking or dragging on it doesn't paint, erase or select, and hovering it shows no paint preview. It stays readable and clickable at every zoom level, even when the pattern runs underneath it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- New Pattern goes at the start of the aqua header box, not inside the dark logo box and not in a box of its own.
- Zoom floats inside the canvas box rather than sitting in a column outside it. This reverses ticket 18's choice to take the controls out of the box, while keeping the rest of ticket 18: the snug fit to the Pattern's proportions and the border visible on all four sides.
- The stack is ordered + / % / − / reset, with zooming in at the top.
- ADR 0004 (which puts New Pattern and zoom in the above-canvas panel) and ADR 0005 (which describes the tool strip as a second row below them) each get an amendment note recording the new placement.

- [ ] New Pattern renders as the first item in the aqua header box and no longer appears above the canvas
- [ ] New Pattern still opens the New Pattern form, and is still disabled while no Patterns are saved
- [ ] The zoom controls render as a vertical stack (+, %, −, reset) inside the canvas box on its right edge, only while a Pattern is open, and no longer appear above the canvas
- [ ] The zoom stack stays in the same spot inside the box while the pattern is scrolled, zoomed or rotated
- [ ] Clicking, dragging or hovering over the zoom stack never paints, erases, selects or shows a hover preview on the cells beneath it
- [ ] The canvas box still fits the Pattern snugly and shows its border on all four sides at every zoom level
- [ ] With both controls moved, no empty row is left above the tool strip
- [ ] Tooltips and `aria-label`s on the zoom buttons are unchanged in both languages
- [ ] ADR 0004 and ADR 0005 carry amendment notes for the new placement
