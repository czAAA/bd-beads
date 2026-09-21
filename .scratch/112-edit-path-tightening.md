# 112: Edit-path tightening (optional)

**What to build:** Make editing a Pattern cost in proportion to what was touched, not to the size of the Pattern, if the targets are not already met without it. Measured before this work, the edit path itself (painting a cell and applying the Row progress lock) cost about 4 ms at 250×250 and about 1 ms at 70×250; almost all of the per-step time was rendering, which the renderer removes. So this ticket may not be needed, and it is last on purpose: run ticket 103's performance check after 111, and only do this if 250×250 still misses the floor target at 4× slowdown, or if memory use with long Undo histories on large Patterns is a problem.

If it goes ahead: copy only the rows a stroke touched, keep the library from making every bead reactive, and store Undo history as the cells each stroke changed instead of a whole-grid snapshot per step. None of it may change what the person sees or what is stored: the stored format, the Pattern file, and the behaviour of Undo, Redo, the Row progress lock and Mirror are untouchable (ADR 0018).

**Blocked by:** 111 (Delete the DOM grid and the temporary switch)

**Status:** ready-for-agent

- [ ] The performance check is re-run on the finished renderer and the result is written here; if hover and paint already hold at least 30 fps at 4× CPU slowdown at 250×250 and memory with a long Undo history is acceptable, close this ticket as `wontfix` with those numbers and stop
- [ ] Otherwise: painting, erasing and Fill cost time in proportion to the beads they change, not to the Pattern's size, shown by the performance check
- [ ] Undo history no longer holds a whole grid per step, and Undo and Redo restore exactly the same states as before, including Row progress, Bead, size and Mirror axis counts
- [ ] The stored library, Pattern files and QR sharing are byte-for-byte unchanged (ticket 103's compatibility test passes)
