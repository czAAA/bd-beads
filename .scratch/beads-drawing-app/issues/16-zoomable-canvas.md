# 16: Zoomable, screen-bounded pattern canvas

**What to build:** The Pattern canvas always renders inside its own fixed-size box that fits within the screen, regardless of the Pattern's grid size. When a Pattern's grid is larger than the box, it opens zoomed out just enough to show the whole grid; zoom in/out controls let the user adjust the zoom level at any time while working.

**Blocked by:** 01, 14

**Status:** ready-for-agent

- [ ] The canvas box has a fixed maximum size that always fits within the visible viewport, independent of the Pattern's grid size
- [ ] Opening a Pattern whose grid is larger than the box's natural size auto-fits it (zoomed out to show the whole grid); a Pattern that already fits opens at 100%
- [ ] Zoom in/out controls are available at all times while a Pattern is open, clamped to a sane range, with a reset back to the fit level for the current Pattern
- [ ] Switching to a different Pattern re-fits the zoom to that Pattern, rather than carrying over the previous one's zoom level
- [ ] Zooming is a view-only transform — it never changes the underlying Pattern data (painted cells, dimensions)
- [ ] Layout uses the design tokens from ticket 02 rather than one-off styling
