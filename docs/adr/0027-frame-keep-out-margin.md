# The Frame keeps a 3-bead margin clear of beads

**Status: accepted.** Amends [ADR 0026](0026-open-canvas-and-frame.md): its rule that drawing right next to the Frame, or inside the room its rulers need, is allowed no longer holds. Ticket 261.

## Context

ADR 0026 made the Frame a line only. Beads could be drawn hard against it, which crowds its line and rulers, makes the edge of the Pattern hard to read, and meant Rotate already had to keep a Piece 3 beads from the turned Frame to leave room for them.

## Decision

- While a Frame is set, the 3 positions all round it, outside its line, are a **keep-out margin**. No tool places a bead there: Paint strokes, Fill, Paste and Mirror paint only the allowed beads; Erase works anywhere. One stroke stays one Undo step.
- The rule lives at one seam: every drawing command's result goes through `keepAllowedEdits` (the Row progress lock plus the margin), which takes back whatever it newly painted in the margin.
- Setting, moving or resizing the Frame, and Rotate, move every Piece that reaches the margin clear (the machinery Rotate already had, now shared in `domain/margin.ts`), with a Message counting beads and one Undo step that restores beads and Frame together.
- The margin is drawn flat: no fill, and the empty-position dots are left out of it. A dashed outline of its outer edge shows only while the Frame is being set, moved or resized and for 1s after a press in it is refused, and the pointer shows `not-allowed` over it for tools that cannot place beads there. Removing the Frame removes the margin and the outline. (Amended 2026-10-05, ticket 276: first drawn as a faint band in the dot's color at half strength, reversed to follow the v18 `Frame` card.)
- Saved Patterns are not migrated: beads already in a margin open unchanged and are moved the first time the Frame is edited, not on load. Export, Beads needed and Row progress read the Frame only, so they are unchanged.

## Considered options

1. **Refuse the drawing at the pointer** (never start a stroke in the margin). Misses Fill, Paste and Mirror counterparts, and cuts a stroke short instead of painting its allowed part. Rejected.
2. **Filter the result of every drawing command (chosen).** One place, covers every command and live Mirror counterparts, and a stroke across the margin keeps its allowed beads.
3. **Migrate saved Patterns on load.** Changes a Pattern the person did not touch. Rejected.

## Consequences

- A Frame cannot be set so that it leaves the beads it crowds in place; they move, whole Pieces at a time, to the nearest clear space.
- Pieces straddling the Frame are split at its line: the beads inside stay, the ones outside move.
- The `Frame` card draws the margin and its outline (amended 2026-10-05, ticket 276; before, the design system had no card for the band).
