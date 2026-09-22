# 123: Resize by button click, and delete a single row/column from the ruler

**What to build:** Two related changes to how a Pattern's grid is resized, both driven by direct clicks instead of typing a number:

- In the Size tool group, the columns/rows fields stop being editable number inputs. Each becomes a read-only count (matching Mirror's axis-counter look: a value with − and + buttons either side) that adds or removes one row/column at a time from whichever end the existing "change from start/end" choice points at. Stepping still honors the existing peyote/brick-stitch pairs-from-start rule: from the start, a step moves by 2 rows and the − button disables rather than allowing an odd change; from the end, or for columns, it steps by 1. The button is disabled the same way Resize is already refused today (Row progress locked, or a step that would go below 1 row/column).
- The row and column rulers become clickable: clicking a number on the row ruler, or on the column ruler, selects that entire row or column, using the existing Selection (a full-width or full-height rectangle) — it highlights on the canvas exactly the way a Select-tool drag does.
- A new tool, in the Tools group next to Erase, removes exactly the selected row or column — unlike the Size group's Resize, which can only trim from an end, this deletes the specific line that's selected (any index, not just an end), shifting the rest of the grid to close the gap. It's enabled only when the current Selection is exactly one full row or one full column, applies as one undo step, and is refused while Row progress is locked, same as Resize.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The Size group's columns/rows show a live count with − / + buttons instead of a typeable input; there is no way left to type a number into it
- [ ] + / − step by 2 (and skip odd counts) when anchored at the start on peyote/brick stitch rows, by 1 everywhere else, and disable at the same limits Resize refuses today (Row progress locked, below 1)
- [ ] Clicking a row ruler's number selects that whole row; clicking a column ruler's number selects that whole column; the selection highlights on the canvas like a Select-tool drag
- [ ] A new "remove this row/column" tool sits in the Tools group next to Erase, enabled only when the Selection is exactly one full row or column
- [ ] Using it removes that specific row/column (from any index, not just an end) and shifts the rest of the grid to close the gap, in one undo step
- [ ] The new tool is refused (disabled or a no-op) while Row progress is on, matching Resize's existing lock behavior
