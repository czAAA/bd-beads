# 102: Resize from the start

**What to build:** Each direction of Resize gets a "change from: end | start" choice (end stays the default). Changing from the start adds or removes the left column or top row, so the painted design slides with that edge instead of staying pinned to the top-left. Terms: CONTEXT.md (Resize); [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md).

**Blocked by:** 101 (Resize from the end)

**Status:** done

- [ ] Each direction has its own toggle, "change from: end | start", in the Size group. It is a setting of the editing session and does not need to be saved with the Pattern
- [ ] From the start, growing adds empty cells at the left/top and shifts the painted design right/down with it, and shrinking removes the leftmost/top-most columns/rows with their painted cells and shifts the rest back. Directions are as seen on screen, so rotating the Pattern swaps them
- [ ] On peyote and brick stitch, changing **rows from the start** moves in steps of 2 (the input steps by 2 and an odd change is not accepted), because an odd shift would flip which rows are stepped half a bead and shove the whole design sideways. Columns, loom rows, and every end-anchored change are unrestricted. The reason is stated near the input
- [ ] Everything from ticket 101 holds for start-anchored changes too: the cap, the Row progress lock, one undo step, Redo, the Selection clear, and the Mirror reset
- [ ] Both EN and RU strings
- [ ] Tests cover start-anchored grow and shrink for loom and for peyote and brick stitch (including the pairs rule and the design's cells landing where expected), the rotated swap, and Undo restoring a start-anchored shrink in full
