# The Frame keeps a 3-bead margin clear of beads

**Status: accepted.** Tickets 261, 276, 317.

Beads drawn hard against the Frame crowd its line and rulers and make the Pattern's edge hard to read. So while a Frame is set, the 3 positions all round it, outside its line, are a **keep-out margin**.

- **No tool places a bead there.** Paint, Fill, Paste and Mirror place only the allowed beads; Eraser works anywhere. One stroke stays one Undo step.
- **The rule lives at one seam.** Edit applies it to every drawing command's result, together with the Row progress lock, and takes back whatever was newly painted in the margin ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)). The domain's `mayPlace(project, position)` answers the same question for press feedback.
- **Frame changes move what crowds it.** Setting, moving or resizing the Frame, and Rotate, move every Piece that reaches the margin to the nearest clear space (`domain/margin.ts`), with a Message counting beads and one Undo step that restores beads and Frame together. A Piece straddling the Frame is split at its line: the beads inside stay, the ones outside move.
- **The margin is drawn flat**: no fill, and no empty-position dots in it. A dashed outline of its outer edge shows only while the Frame is being set, moved or resized, and for 1s after a press in it is refused; the pointer shows `not-allowed` over it for tools that place beads. The `Frame` card draws it.
- **Saved Projects are not migrated**: beads already in a margin open unchanged and move the first time the Frame is edited. Export, Beads needed and Row progress read the Frame only, so they are unaffected.

**Considered options**: refusing at the pointer, never starting a stroke in the margin (rejected: misses Fill, Paste and Mirror's counterparts, and cuts a stroke short instead of keeping its allowed part); migrating saved Projects on load (rejected: changes a Project nobody touched); a faint band in the margin (built first, then dropped for the design system's `Frame` card).
