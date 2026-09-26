# 141: App shell: one scrolling left column, canvas box fills the rest

**What to build:** The app's layout becomes the one in `DESIGN.md` §4: a header row, a 326px left column that scrolls on its own, and a canvas box that takes all the remaining width and height. The page itself never scrolls; the Pattern scrolls inside the canvas box. The existing Toolbox, Beads needed and Saved Patterns move into the left column as four separate boxes in the fixed order (Toolbox, save box, Beads needed, Saved Patterns), using the current components and current look for now: later tickets restyle each. The below-canvas panel is gone, and the library-wide notice row sits directly under the header. With no Pattern open, or during a Convert image framing step, the New Pattern form takes the Toolbox's place.

**Blocked by:** 136

**Status:** ready-for-agent

**Design system v13:** the page uses `100dvh`, the z-index tokens for its layers, and the MacBook Air tier values from `responsive.md` (the reference layout).

**Note (performance plan, ADR 0018):** resizing the canvas box must not redraw the Drawing surface more often than today (no per-scroll-frame resize).

- [ ] At 1440×900 the layout matches the wireframe in §4: 64px header, 326px column (312px boxes plus a 14px scrollbar gutter, 16px between boxes), canvas box filling the rest, 24/32 page padding, 14px gap between column and box
- [ ] The left column scrolls by itself (thin scrollbar) and never scrolls the canvas; the header and the canvas box's own top and bottom stay in view on a Pattern of any size
- [ ] A Pattern larger than the canvas box scrolls inside the box; the page has no scrollbar
- [ ] The notice row takes no space while there is nothing to say
- [ ] The four boxes appear in the specified order and the existing features in them still work
- [ ] Existing tests pass, and layout-dependent behaviors (zoom to fit, drag to pan, hover) still work in the new container
- [ ] ADR 0004 and ADR 0005 layout amendments that this replaces are noted as superseded by ADR 0021
