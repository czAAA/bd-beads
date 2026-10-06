# 321: Zoom pill rests anywhere on the canvas, not only in a corner

**What to build:** Today the phone's **Zoom pill** can be dragged but snaps to one of four corners on release (ticket 297). Change it so it stays exactly where the person drops it, anywhere inside the canvas box, always fully visible. The position is kept on the device, and stays fully visible after rotation, resize, the Dock or sheets changing the canvas box, and Fit. Keyboard: Alt + arrow keys nudge the pill in steps instead of jumping corner to corner. Update the Zoom pill definition in CONTEXT.md and the design system notes (Dock README / responsive.md, DESIGN.md §6) that describe corner snapping.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Dragging the pill and releasing leaves it at the release position (no snapping), clamped so the whole pill is inside the canvas box
- [ ] The position persists across reloads on the device; a stored position from the old corner-only format still loads sensibly (the stored corner becomes its position)
- [ ] When the canvas box shrinks or the screen rotates, the pill is pulled back so it is fully visible, and keeps its relative position when the box grows again
- [ ] Alt + arrow keys move the pill by a step, clamped to the canvas box; the pill remains reachable without drag
- [ ] A tap still presses the button; drag threshold (~6px) unchanged
- [ ] Unit tests for the placement/clamp logic replace the nearest-corner tests; the unused corner code is removed (knip clean)
- [ ] CONTEXT.md Zoom pill entry, design system docs and, if needed, the ADR for corner snapping are updated
