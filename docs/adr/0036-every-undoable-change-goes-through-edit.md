# Every undoable change goes through Edit

**Status: accepted.** Builds on [ADR 0023](0023-app-vue-decomposition-boundaries.md) (one-responsibility flows) and refines [ADR 0027](0027-frame-keep-out-margin.md): `keepAllowedEdits` is no longer called by each command but applied by Edit. Ticket 317, candidate D1 of the architecture review of 2026-10-05.

## Context

About 11 commands assembled their own edit. `keepAllowedEdits` was used by 3 of them, so the Row progress lock and the keep-out margin were each command's to remember. Undo entries came in four shapes built by hand in six places. Each Frame flow called `recordHistory`, then `replaceProject`, then cleared Mirror's axis counts and the Selection itself. The margin rule was also restated in the canvas surface for press feedback. A new command could skip any of it and still type-check.

## Decision

- **One entry point.** `useEdit` gives `edit(kind, project => result)`. It reads the open Project, runs the command, applies the guards for its kind, records the Undo entry, replaces and saves the Project, runs the session resets, and returns `unchanged | refused | applied { moved }`. Flows use the outcome only to pick their wording.
- **Three kinds.**
  - *drawing* (Paint, Fill, Paste, Eraser, Mirror current, Delete selection): the Row progress lock and the margin are applied silently; an edit left with no effect is no Undo step.
  - *frame* (everything through `changeFrame`, Remove row/column included): refusals come from `changeFrame`; after a change Edit calls one injected `resetAfterFrameChange()`, which App wires to Mirror's axis counts, the Selection and the hover.
  - *exempt* (Delete all, Replace Bead): no guards. Clearing progress is Delete all's point; Replace Bead touches no bead.
- **Strokes.** A Paint/Eraser stroke is `beginStroke / strokeStep / endStroke`: the baseline is taken at the start, each step applies the drawing guards and defers its save, the end pushes one Undo entry (only if something changed) and flushes the save once (ticket 55).
- **One Undo entry shape.** Every Edit records a full snapshot: beads, Row progress, the Bead, the Frame and Mirror's axis counts. They are immutable references, so it costs nothing. `UndoEntry` and `restoreSnapshot` have no optional fields. `useUndoHistory` keeps only the stacks and Undo/Redo, which restore through Edit's `restore`: it runs the session resets but not the guards, since Undo replays history and the lock never blocks it.
- **Who can write.** Undoable flows receive `edit`, not `replaceProject`, `recordHistory` or a `commitGridChange`, so bypassing the rules no longer type-checks. Only the non-undoable Row ops (toggle, direction, pointer) and Undo/Redo keep `replaceProject`.
- **One margin rule.** The domain exports `mayPlace(project, position)`: not in a finished row and not in the margin. The canvas surface's press feedback asks it instead of restating the margin check, and so will the press interpreter.
- **Flows keep gesture and wording.** A flow decides when to edit and what to say after (a toast with Undo, or an announcement); it no longer knows the rules.

## Considered options

1. **Keep `commitGridChange` and add `commitFrameChange`.** Rejected: still two paths that each flow must choose between, and the entry shapes stay hand-built.
2. **Let each flow pass the guards it wants.** Rejected: that is today's problem with a bigger signature.
3. **Make `useUndoHistory` own the commit.** Rejected: history is stacks and stepping; the rules belong to the change, not to the record of it.

## Consequences

- A new undoable command picks a kind and cannot forget a rule. A fourth kind would need an ADR.
- Undo and Redo now restore Mirror's axis counts for every step, not only Frame changes.
- Flow tests drive a real `useEdit` and assert behaviour (Undo brings it back, a stroke across finished rows leaves them alone, a stroke is one Undo step and one save).
- Pressing a finished row with a tool that places beads now shows the same refusal as pressing the margin, since the surface asks `mayPlace`.
- What `resetAfterFrameChange` resets stays App's business until Mirror moves into its own module (candidate D4).
