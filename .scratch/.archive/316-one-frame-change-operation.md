# 316: One Frame change operation, with its rules applied once

**What to build:** Every change of the Frame (Set Frame, moving or resizing it, Fit to drawing, Remove Frame, Rotate, Remove row/column) goes through one pure domain operation, `changeFrame`, that owns the rules such a change has to keep. Today each flow assembles its own: Set Frame calls `withFrame` then `clearMargin`, Rotate builds its turned Project without the pointer clamp `withFrame` applies (ticket 305), Remove line checks its own refusal, and the Row progress lock is checked in each flow. The margin Message also counts different things: Set Frame says "N beads were in the margin", Rotate says "N pieces were in the way".

`changeFrame` takes a Project and one change, given as a union of four variants:

- `{ set: Frame }`: Set Frame, moving it, resizing it, and Fit to drawing all reduce to this. Whether the Message leads with "Frame set", "Frame moved" or "Frame resized" stays the flow's choice; it is only wording.
- `{ remove }`: Remove Frame.
- `{ rotate }`: Rotate.
- `{ removeLine: { axis, index } }`: Remove row/column.

It returns one of: refused (with the reason, e.g. Row progress is on, or no Frame to rotate), unchanged (same Project instance), or the changed Project plus how many Pieces it moved clear. Inside it, in one place:

- **Refusal** while Row progress is on (its rows are the Frame's), and the per-variant refusals that exist today (Rotate and Remove line need a Frame; Remove line needs a valid row/column).
- **Pointer clamp**: both Row progress pointers end inside the new Frame, through one `clampPointer` function. Candidate D2 (Row progress as its own module) will later move that function; this ticket only makes it the one clamp a Frame change uses.
- **Margin**: every Piece the new Frame's keep-out margin (or the turned Frame) reaches moves clear, whole, as now (ADR 0027).
- **One count unit: Pieces.** The margin Message after Set/move/resize Frame now counts Pieces moved, like Rotate already does, since the relocation moves whole Pieces. Update the EN and RU wording to match.

The flows (Set Frame, Rotate, Remove line) call `changeFrame` and keep only their gesture, wording and the undo/replace calls they make today; ticket 317 then routes those through one Edit entry point. No user-visible behaviour changes except the margin Message's count unit. Ticket 305 (the plain Rotate pointer fix) ships first; its regression test must keep passing here. Candidate D1 of the architecture review of 2026-10-05.

**Blocked by:** None (can start immediately). Ticket 305 should land first, but this ticket doesn't need it to start.

**Status:** done

- [x] `changeFrame` is a pure domain function taking the four-variant change above and returning refused / unchanged / changed-with-Pieces-moved
- [x] Table tests cover change variant × rule: refused while Row progress is on, per-variant refusals, pointers clamped inside the new Frame for both Row directions, margin left empty with Pieces moved whole, the moved count in Pieces, and no-change returning the same instance
- [x] The existing Frame, Rotate and Remove-line domain tests are moved onto `changeFrame` (or deleted where a table row covers them); ticket 305's regression test still passes
- [x] Set Frame, move, resize, Fit to drawing, Remove Frame, Rotate and Remove line all go through `changeFrame`; no flow calls `withFrame`, `clearMargin` or `rotateProject` directly any more, and none checks the Row progress lock itself
- [x] The margin Message after Set/move/resize Frame counts Pieces, in EN and RU
- [x] CONTEXT.md's Keep-out margin entry says the Message counts the Pieces moved
- [ ] Typecheck, lint, unit tests and the visual check pass in CI
