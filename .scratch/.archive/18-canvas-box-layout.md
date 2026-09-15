# 18: Canvas box: controls above the grid, snug fit, visible border on all sides

**What to build:** Rework the Pattern canvas box (ticket 16) so it reads as a bounded notepad page sized to the open Pattern, not a fixed square with the zoom controls floating over its top edge. The zoom controls (−, %, +, reset) move into the above-canvas panel (ADR 0004), leaving the canvas box itself as just the pattern surface. The box's highlighted frame follows the Pattern's actual proportions instead of centering it inside a fixed maximum square, so wide-and-short or narrow-and-tall Patterns don't leave large empty bands above/below or left/right. The grid's bold outline is visible on all four sides at every zoom level, not just the left and top.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Zoom in/out/reset controls and the zoom percentage render in the above-canvas panel, not inside the bordered canvas box
- [ ] The canvas box's highlighted frame sizes itself to the open Pattern's aspect ratio (within the same screen-bounded maximum from ticket 16), instead of always centering the Pattern inside a fixed square
- [ ] No large empty bands of unused space remain above/below or left/right of the Pattern inside the canvas box, at any zoom level in the clamped range
- [ ] The grid's bold border is fully visible on all four sides (left, top, right, bottom) at every zoom level, including the fit-to-screen level
- [ ] Layout continues to use the design tokens from ticket 02
