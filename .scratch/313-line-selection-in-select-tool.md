# 313: Line selection lives in the Select tool

**What to build:** Selecting a whole row or column becomes part of the one Select tool, alongside dragging an area. Clicking a ruler number inside a Piece area (with or without a Frame) marks out that line with the same Selection and highlight as an area drag; there is no separate line-selecting mode. A selected line then behaves like any Selection:
- drawing a bead (Paint, Fill) drops the line selection;
- `Del` or an Eraser click empties every bead on the line, as one Undo step;
- Remove row/column works with no Frame: the line is cut out, every later line shifts up or left to close the gap, and the Piece area gets one line shorter, with a new empty line outside it. Undo restores it.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A ruler-number click selects that row or column through the Select tool, in a Piece area with no Frame and in a Frame; no second tool or mode is needed to select a line
- [ ] Painting or filling a bead while a line is selected clears the Selection
- [ ] `Del` and an Eraser click on a selected line clear every bead on it; one Undo step; honours Mirror and the Row progress lock like other erases
- [ ] Remove row/column is enabled for a selected line with no Frame; with line 3 removed, old line 4 becomes 3, and so on, and the Piece area is one line shorter; one Undo step restores it
- [ ] Remove row/column with a Frame, and its refusal while Row progress is on, behave as before
- [ ] Beads outside the removed line's Piece area are unaffected
- [ ] CONTEXT.md (Selection, Remove row/column, Piece area) updated, and an ADR amended or added if the Frame-only rule of Remove row/column was recorded in one
- [ ] Correct on phone through desktop, by pointer, touch and keyboard
- [ ] Overview and Tour question (CLAUDE.md): not asked, Tour is off
