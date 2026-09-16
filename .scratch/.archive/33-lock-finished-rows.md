# 33: Lock finished rows against drawing

**What to build:** While the Row progress overlay is on, the finished (dimmed) rows can't be drawn on. Those beads are already woven, so a stray click or drag must not change them. Every drawing command leaves them exactly as they were: Paint and its drags, right-click erase, Fill, Paste, live Mirror counterparts, and the one-time Mirror current. The edit still lands everywhere else. An edit that would only have touched finished rows changes nothing and adds no undo step. The hover preview doesn't show paint landing on finished beads. "Finished" follows the Row progress direction (ticket 32): rows before the pointer, or columns before it once rows run down the columns. The row being woven now is still editable.

**Blocked by:** 32

**Status:** done

**Decisions (2026-09-16):**
- The lock applies only while the overlay is on. With it off nothing is shown as finished, so nothing is locked.
- Undo is not blocked. It restores an earlier grid exactly, as history rather than drawing, so it can still revert a change made before a row was marked done.
- Selecting and Copy still work on finished rows, since they only read cells.
- Tests go at the same seams as ticket 32: the domain guard in `pattern.ts`, and `App` for each drawing command and the preview.

- [ ] With the overlay on, painting, drag-painting or right-click erasing a bead in a finished row leaves it unchanged, adds no undo step, and still works on the current row and the rows after it
- [ ] Fill, Paste, live Mirror counterparts and Mirror current change only beads outside the finished rows; the finished beads keep their colors
- [ ] Hovering a finished bead shows no paint preview; a preview spanning both finished and unfinished beads shows only the unfinished ones
- [ ] The lock follows the direction: once rows run down the columns, the finished columns are locked instead
- [ ] With the overlay off, every bead can be drawn on as before
- [ ] Undo still restores the previous grid in full
