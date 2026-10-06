# 317: One Edit entry point for every undoable change

**What to build:** Every undoable change to the open Project goes through one composable, `useEdit`, which applies the rules that make a Project trustworthy (finished rows locked, the keep-out margin empty, one correct Undo step, the right session resets) so no command has to remember them. Today about 11 commands assemble their own edit: `keepAllowedEdits` is used by 3 of them, undo entries come in 4 shapes built by hand in 6 places, and each Frame flow calls `recordHistory`, `replaceProject`, then clears Mirror's axis counts and the Selection itself. The keep-out margin rule is also restated in the canvas surface for press feedback.

**The call.** `edit(kind, project => result)`: Edit reads the open Project, runs the command on it, applies the guards for its kind, records the undo entry, replaces and saves the Project, runs the session resets, and returns an outcome, `unchanged | refused | applied { moved }`. Flows use the outcome only to pick their wording (toast with Undo, or announcement), which keeps ADR 0023's one-responsibility flows and removes what they all copy.

**Three kinds:**

- **drawing**: Paint, Fill, Paste, Eraser, Mirror current. The Row progress lock and the margin are applied silently (what lands on finished rows or in the margin is dropped, erasing in the margin still works), and an edit left with no effect is no Undo step.
- **frame change**: everything that goes through `changeFrame` (ticket 316), Remove row/column included. Refusals come from `changeFrame`; after a change Edit calls one injected `resetAfterFrameChange()` dep. Edit decides *when* to call it; what it resets (Mirror's axis counts, the Selection, hover) stays App's business until candidate D4 moves Mirror into its own module.
- **exempt**: Delete all (clearing progress is its point) and Replace Bead (touches no bead). No guards.

Row progress toggles, Row direction and moving the pointer are not undoable and stay outside Edit, as now.

**Strokes.** A Paint/Eraser stroke goes through Edit as `beginStroke / strokeStep / endStroke`: the baseline is taken at the start, each step applies the drawing guards and defers its save, and the end pushes one Undo entry (only if something changed) and flushes the save once, as today (ticket 55).

**One undo entry shape.** Every Edit records a full snapshot: beads, Row progress, the Bead, the Frame and Mirror's axis counts. They are all immutable references, so this costs nothing. `UndoEntry` and `restoreSnapshot` lose their optional fields. `useUndoHistory` keeps only the stacks and Undo/Redo; Undo/Redo restore through Edit's session resets but skip its guards (Undo replays history, so the lock never blocks it).

**Who can write.** Undoable flows get `edit` instead of `replaceProject`, `recordHistory` and `commitGridChange`, so bypassing the rules no longer type-checks. Only the non-undoable Row ops and Undo/Redo keep `replaceProject`.

**One margin rule.** The domain exports `mayPlace(project, position)` (Row progress lock + margin). Edit enforces it; the canvas surface's press feedback asks it instead of restating the margin check. Candidate A4 (press interpreter) will ask the same predicate later.

No user-visible behaviour changes. Candidate D1 of the architecture review of 2026-10-05.

**Blocked by:** 316 (One Frame change operation).

**Status:** done

- [x] `useEdit` exists with `edit(kind, command)` returning `unchanged | refused | applied { moved }`, and stroke calls `beginStroke / strokeStep / endStroke`
- [x] Paint, Eraser, Fill, Paste, Mirror current, Set/move/resize Frame, Fit to drawing, Remove Frame, Rotate, Remove row/column, Delete all and Replace Bead all go through it; none of their flows depends on `replaceProject`, `recordHistory` or `commitGridChange`
- [x] `UndoEntry` is one full-snapshot shape with no optional fields; `useUndoHistory` holds only the stacks and Undo/Redo
- [x] Frame changes call `resetAfterFrameChange()` once, from Edit; no flow clears Mirror's axis counts or the Selection itself
- [x] `mayPlace` is the only statement of the lock + margin rule; the canvas surface uses it for press feedback
- [x] Flow tests drive a real `useEdit` and assert behaviour ("Undo brings it back", "a stroke across finished rows leaves them alone", "a stroke is one Undo step and one save") instead of stubbing `recordHistory` or matching undo-entry literals
- [x] ADR 0036 (0034 and 0035 were taken), "Every undoable change goes through Edit", records the three kinds, the full-snapshot undo entry, `mayPlace`, and that flows keep only gesture and wording (building on ADR 0023)
- [ ] Typecheck, lint, unit tests and the visual check pass in CI
