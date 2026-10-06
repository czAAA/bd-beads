# A Pattern is an open canvas; a Frame marks which beads are the Pattern

**Status: accepted.** Supersedes [ADR 0017](0017-grid-is-the-size-mm-is-an-estimate.md)'s "the grid is the size" (the grid no longer exists; the Frame is the size, and the millimetres are still an estimate) and its Size tool group and Resize. Supersedes [ADR 0019](0019-a-pattern-has-no-size-limit.md)'s per-Pattern grid size limit discussion only in that there is no grid to size; its measured limits (speed, storage, memory) still apply to the number of beads. Amends [ADR 0009](0009-compact-grid-encoding.md) (the stored encoding carries positions and a Frame) and [ADR 0010](0010-convert-image-fixed-physical-size.md) (the picture lands in a Frame of the stated size). Ticket 233; spec in design system v16.

## Context

A Pattern was a fixed `columns × rows` grid made before the first bead. That forced the person to know the size up front, made "I drew past the edge" a Resize chore (Size group, Change size, add and remove rows and columns), and left the board, its whole-grid rulers and the grid-sized exports tied together. Weavers sketch first and decide the piece's edges later.

## Decision

- A Pattern is an **open canvas**: an endless field of bead positions addressed by integer `(row, column)`, negative included. Only painted positions are stored.
- Beads that touch by a side or a corner form a **Piece**; a Piece has a rectangle and, while there is no Frame, its own rulers (columns above, rows left, from 1).
- At most one **Frame** per canvas: a rectangle on whole beads (`row`, `column`, `columns`, `rows`) that marks which beads are the Pattern. It is a line only; drawing outside it stays possible and is saved. Export, Row progress, Rotate and Beads needed read the Frame. With a Frame, piece rulers hide and the Frame's rulers show on all four sides.
- **Set Frame** (F, the Frame row in the Toolbox) draws, moves and resizes it; **Fit to drawing** wraps every bead; **Remove Frame** clears it. Frame changes are Undo steps and never change a bead.
- **Rotate** turns the Frame and the beads about the Frame's centre; a Piece in the way moves clear, with a Message and one Undo. Without a Frame it is disabled.
- Storage keeps beads by position with the Frame beside them. Every Pattern, Pattern file and QR code written before opens unchanged with a Frame the size of its old grid; the old grid-shaped reader stays, as the one place that still knows a fixed size.

## Considered options

1. **A fixed grid with a Frame drawn on top.** Smallest change, but it keeps the board, the Size group and Resize, and still makes someone choose a grid first; "draw outside the Frame" would mean growing the grid anyway. Rejected.
2. **An endless canvas with a Frame (chosen).** Removes the size decision from creation and the Resize commands from the product; costs a position-keyed model and a viewport that is not clipped to a board.

## Consequences

- The Size group, Change size, Add/remove row-column, the board and the whole-grid rulers are removed, with their code and strings. Remove line (the selected whole row or column) stays, as the design system's Tools group and Tour still have it, and now works on the Frame: its beads after the line close the gap, the Frame shrinks by one, beads outside it stay put. Ticket 313 extends it to a Piece area while there is no Frame: the area's beads after the line close the gap and the area ends one line shorter.
- Fill is bounded on open space (it stops at the edge of the painted region plus one bead of margin) and never runs away.
- Everything that read `columns`, `rows` and a dense `grid` now reads the Frame or the bead map; this lands in steps, each leaving the app working.
