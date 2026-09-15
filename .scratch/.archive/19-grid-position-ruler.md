# 19: Row and column position ruler around the pattern grid

**What to build:** A ruler around the pattern grid showing row numbers on the left and right edges and column numbers on the top and bottom edges, so the user always knows which row and column of beads they're currently working on. The ruler stays aligned with the grid as it's zoomed and scrolled.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] Row numbers are visible along both the left and right edges of the grid, one per row
- [ ] Column numbers are visible along both the top and bottom edges of the grid, one per column
- [ ] Ruler numbers stay aligned with their corresponding row/column at every zoom level and while scrolling
- [ ] Ruler numbering follows the Pattern's technique-specific row geometry (e.g. peyote/brick offsets) rather than a plain rectangular grid assumption
- [ ] The ruler is legible at the smallest and largest zoom levels in the clamped range, or degrades gracefully (e.g. thins out) rather than becoming illegible clutter
