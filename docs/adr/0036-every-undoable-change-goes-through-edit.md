# Every undoable change goes through Edit, and Undo is a session of whole snapshots

**Status: accepted.** Tickets 34, 189, 317.

About 11 commands used to assemble their own edit: the Row progress lock and the keep-out margin were each command's to remember, Undo entries came in four hand-built shapes, and each Frame flow reset Mirror and the Selection itself. A new command could skip any of it and still type-check.

- **One entry point.** `useEdit` gives `edit(kind, project => result)`: it reads the open Project, runs the command, applies the guards for its kind, records the Undo entry, replaces and saves the Project, runs the session resets, and returns `unchanged | refused | applied { moved }`. Flows use the outcome only to pick their wording; a flow decides when to edit and what to say after, and no longer knows the rules.
- **Three kinds; a fourth needs an ADR.**
  - *drawing* (Paint, Fill, Paste, Eraser, Mirror current, Delete selection): the Row progress lock and the margin ([ADR 0027](0027-frame-keep-out-margin.md)) apply silently, and an edit left with no effect is no Undo step.
  - *frame* (everything through `changeFrame`, Remove line included): refusals come from `changeFrame`; after a change Edit calls one injected `resetAfterFrameChange()`, which the shell wires to Mirror's axis counts, the Selection and the hover.
  - *exempt* (Clear, Replace Bead): no guards. Clearing progress is Clear's point; Replace Bead touches no bead.
- **Strokes**: `beginStroke / strokeStep / endStroke`. The baseline is taken at the start, each step applies the drawing guards and defers its save, and the end pushes one Undo entry (only if something changed) and flushes the save once ([ADR 0012](0012-saving-follows-the-pattern-library.md)).
- **Who can write.** Undoable flows receive `edit`, never `replaceProject` or the history, so bypassing the rules doesn't type-check. Only the non-undoable Row progress operations (switch, direction, current row) and Undo/Redo keep `replaceProject`.
- **One margin rule** in the domain: `mayPlace(project, position)`, not in a finished row and not in the margin. The canvas's press feedback asks it, so pressing a finished row shows the same refusal as pressing the margin.

## Undo

- **Every entry is a whole snapshot**: beads, Row progress, the Bead, the Frame and Mirror's axis counts, with no optional fields. They are immutable references sharing structure with the Project, so a snapshot costs only what changed.
- **History belongs to the editing session**: never saved with the Project, and emptied when another Project opens. A new change clears Redo.
- `useUndoHistory` keeps only the stacks; Undo and Redo restore through Edit's `restore`, which runs the session resets but not the guards: history is replayed as it was, and the Row progress lock never blocks it.

**Considered options**: `commitGridChange` plus a `commitFrameChange` (rejected: two paths every flow must choose between, with hand-built entries); each flow passing the guards it wants (rejected: the old problem with a bigger signature); `useUndoHistory` owning the commit (rejected: the rules belong to the change, not to its record); saving history with the Project (rejected: it would grow every stored Project for a convenience of one session).
