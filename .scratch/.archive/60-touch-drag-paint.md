# 60: Fix touch/pen drag-to-paint on iPhone/iPad

**What to build:** Dragging a finger or Apple Pencil across the pattern grid paints/erases every cell it crosses, the same way a held-down mouse drag already does on desktop. Reported: iPhone touch and iPad (finger and stylus) only register the single cell first touched -- dragging doesn't continue the stroke.

**Root cause:** Painting is wired to mouse-only events (`PatternGrid.vue`'s `@mousedown`/`@mouseenter`, gated by `event.buttons`). Touch and pen never fire a per-cell `mouseenter` as the contact point slides across the grid -- WebKit only synthesizes a single `mousedown`/`click` at the initial touch point, so the first cell registers but nothing after it. There's also no `touch-action` override on the grid, so nothing stops the browser from trying to treat the drag as a scroll/pan gesture instead.

- `PatternGrid.vue`'s cell listeners move from `mousedown`/`mouseenter` to `pointerdown`/`pointerenter`, which unify mouse, touch, and pen.
- Touch and pen pointers get an *implicit* pointer capture on `pointerdown` that routes every later `pointermove` to the first cell touched rather than the one now under the finger/pen -- `onCellDown` releases it immediately so hit-testing (and `pointerenter`) works per-cell again, matching how an unclaimed mouse button already behaves.
- `.pattern-grid` gets `touch-action: none` so the browser doesn't hijack a paint drag as a page/panel scroll before script sees it (there's a horizontally-scrolling ancestor, `.app-shell__canvas-scroll`, that would otherwise compete for the gesture).
- `App.vue`'s stroke-ending listener (`endStroke`, previously bound to `mouseup` on `.app-shell`) also binds to `pointerup`/`pointercancel`, so a touch/pen stroke ends correctly even if the OS cancels the gesture mid-drag.

**Blocked by:** None.

**Status:** done
