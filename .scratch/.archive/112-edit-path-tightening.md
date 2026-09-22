# 112: Edit-path tightening (optional)

**What to build:** Make editing a Pattern cost in proportion to what was touched, not to the size of the Pattern, if the targets are not already met without it. Measured before this work, the edit path itself (painting a cell and applying the Row progress lock) cost about 4 ms at 250×250 and about 1 ms at 70×250; almost all of the per-step time was rendering, which the renderer removes. So this ticket may not be needed, and it is last on purpose: run ticket 103's performance check after 111, and only do this if 250×250 still misses the floor target at 4× slowdown, or if memory use with long Undo histories on large Patterns is a problem.

If it goes ahead: copy only the rows a stroke touched, keep the library from making every bead reactive, and store Undo history as the cells each stroke changed instead of a whole-grid snapshot per step. None of it may change what the person sees or what is stored: the stored format, the Pattern file, and the behaviour of Undo, Redo, the Row progress lock and Mirror are untouchable (ADR 0018).

**Blocked by:** 111 (Delete the DOM grid and the temporary switch)

**Status:** wontfix

- [x] The performance check is re-run on the finished renderer and the result is written here; if hover and paint already hold at least 30 fps at 4× CPU slowdown at 250×250 and memory with a long Undo history is acceptable, close this ticket as `wontfix` with those numbers and stop
- [~] Otherwise (not done: closed as `wontfix`, below): painting, erasing and Fill cost time in proportion to the beads they change, not to the Pattern's size, shown by the performance check
- [~] Undo history no longer holds a whole grid per step, and Undo and Redo restore exactly the same states as before, including Row progress, Bead, size and Mirror axis counts
- [~] The stored library, Pattern files and QR sharing are byte-for-byte unchanged (ticket 103's compatibility test passes)

## Closed as `wontfix`: the floor is held, and the memory is acceptable

**Speed (`npm run perf` after ticket 111, 4× CPU slowdown, 250×250, production build):** hover 60 fps (6 ms a frame), paint stroke 60 fps (10 ms), Selection drag 60 fps, paste hover 60 fps, against the 30 fps floor; at 70×250 paint is 60 fps (9 ms). At 6× all of them are still 60 fps. The edit path this ticket meant to tighten was partly tightened on the way, as ticket 106 needed it to be for paint to hold the floor: `paintCells` now copies only the rows a stroke touches and `keepFinishedRows` looks only at the rows an edit replaced (`editSharing.test.ts`), the stroke step reads the Pattern rather than the library's reactive wrapper, and the bead counts and QR code no longer recompute on every step of a stroke. What is left is not what limits a stroke.

**Memory (`e2e/perf/memory.spec.ts`, 250×250, heap after a forced garbage collection):** 5 MB to start; 8 MB after 300 one-bead strokes (about 10 KB a stroke: a stroke's snapshot is the grid of row references, and the rows it did not touch are shared); 136 MB after 40 whole-Pattern Fills (about 3.2 MB a Fill: a Fill makes every bead of the area a new object, and Undo keeps the grid it started from). A session of a few hundred strokes and a handful of Fills costs a few tens of MB, which a laptop or a recent tablet takes without noticing; someone filling the whole of a 250×250 Pattern dozens of times in one session is unlikely, and Undo is per session (a reload starts it again). I judge that acceptable and have not built the change.

**If it turns out to matter** (a small phone that reloads the tab after a long Fill-heavy session), the cheapest fix is smaller than the ticket's plan: intern the cell objects (one `{ color }` per color shared by every bead of that color, since cells are never mutated in place), which takes a 250×250 grid from about 3 MB to about 0.5 MB of row arrays, for every Fill, Paste, Mirror current and new Pattern alike, with no change to the stored format or to what any operation returns. Storing history as the cells each command changed is the fuller answer and the bigger job. Either way the stored library, Pattern files, QR sharing and the behaviour of Undo, Redo, the Row progress lock and Mirror must stay as they are (ADR 0018), which ticket 103's compatibility test checks.
