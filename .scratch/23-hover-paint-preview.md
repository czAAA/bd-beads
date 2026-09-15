# 23: Hover preview of where paint will land

**What to build:** While hovering over the canvas with a color selected, show a faint preview of that color at the cell under the cursor. In mirror mode, also preview all 2/4 mirrored cells that a stroke would touch.

**Blocked by:** 22 (needs the live-mirror cell computation to know which cells to preview)

**Status:** ready-for-agent

- [ ] Hovering any cell, with any tool active and a color selected, shows a faint (reduced-opacity) preview of the selected color at that cell
- [ ] With no color selected, hovering shows a neutral highlight/outline instead (no color preview)
- [ ] With a mirror axis toggle on, hovering also faintly previews the mirrored counterpart cell(s) — 2 cells for one axis, 4 for both
- [ ] The preview is purely visual and does not modify the grid; it clears when the cursor leaves the canvas
