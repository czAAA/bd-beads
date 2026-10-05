# 298: Zoom out to 10% on every screen, with the ruler numbers thinning

**What to build:** The Zoom floor is 10% on every screen (today 90% on a phone in portrait, 85% on a landscape phone and wider), so a Pattern larger than the screen can be seen whole. Zoom out, pinch, wheel, the zoom buttons and Fit all reach 10%; Fit stays capped at 100%. The rulers keep every number clear by the Ruler step (ADR 0033): numbers every 5, 10, 50, 100 beads as room allows, for Piece rulers and Frame rulers alike. The beads between numbers are left blank for now (ticket 299 adds the dots). Use the glossary terms Zoom floor and Ruler step (CONTEXT.md).

Background: ticket 223 set the floor from the `bead-min-*` tokens (the per-tier floor in `grid.ts`, `useZoomFloor`). The tier floor goes; the two number-size values stay as the point where a number needs more room.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Zoom floor is 10% on every screen and no tier raises it; the per-tier floor and its composable are removed
- [ ] Fit shrinks a large Pattern until all of it is on screen, down to 10%, and never above 100%
- [ ] The Ruler step is the smallest of 5, 10, 50, 100... that keeps numbers from overlapping at any zoom, measured with 3-digit and turned numbers, on Piece rulers and Frame rulers
- [ ] Clicking a ruler number still selects its row or column at every zoom
- [ ] A 999-column Pattern at 10% draws and pans without a visible drop in frame rate
- [ ] Unit tests for the floor, Fit and the Ruler step
