# 34: Redo, with keyboard shortcuts for Undo and Redo

**What to build:** A Redo icon button sits next to Undo in the tool strip. It re-applies the change the last Undo reverted, and pressing it again steps forward further. Its icon is a clockwise arrow, the mirror of Undo's counter-clockwise one, with the same `title` + `aria-label` tooltip pairing the other icon buttons use. Both commands also get keyboard shortcuts: Ctrl/Cmd+Z undoes, and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. The shortcuts work anywhere in the editor, the way Escape already does, but not while the user is typing in a form field.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Any edit that actually changes the grid clears the redo history. That is the same rule that decides whether an edit counts as an undo step, so an edit that lands only on locked finished rows changes nothing and leaves redo intact.
- Switching or creating a Pattern clears the redo history, the same as the undo stack. Like undo, it is an editing-session aid and is never saved with the Pattern.
- Anything that isn't a grid edit leaves redo alone: Rotate, flipping Row direction, moving the Row progress pointer, Select, Copy, and cancelling a Paste.
- Redo is not blocked by the finished-row lock (ticket 33). Like Undo, it replays history rather than drawing.
- Prefactor first: move the undo stack out of `App` into a small domain history module holding both stacks, so the push/undo/redo/clear rules are tested there. `App` keeps the tests for the button, the shortcuts and each edit.
- CONTEXT.md's Language section gains entries for Undo (RU: Отменить) and Redo (RU: Повторить).

- [ ] Redo re-applies the most recently undone change, and repeated Redo steps forward through every undone change in order
- [ ] Undo and Redo can be alternated freely without losing or duplicating a step, including for a whole dragged stroke, a Fill, a Paste and Mirror current
- [ ] A new edit that changes the grid clears the redo history. An edit that changes nothing (for example one aimed only at finished rows) does not
- [ ] Switching or creating a Pattern clears the redo history
- [ ] Rotate, Row direction, the Row progress pointer, Select, Copy and cancelling a Paste leave the redo history untouched
- [ ] Redo restores a grid in full even where it covers finished rows
- [ ] The Redo button renders as a clockwise-arrow icon with a tooltip and `aria-label` in both languages, and is disabled when there is nothing to redo
- [ ] Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo; none of them fire while focus is in a text or number input
- [ ] CONTEXT.md has Undo and Redo glossary entries
