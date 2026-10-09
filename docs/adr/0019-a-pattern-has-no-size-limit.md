# A Project has no size limit: the device is the limit

**Status: accepted.** Tickets 103, 112, 122.

No size is refused anywhere: not when creating a Project (in beads, mm or cm), not in Convert image, not when setting or resizing a Frame, not on import. The renderer's cost follows the screen, not the Project ([ADR 0018](0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)), so a bracelet of 70 × 250 (17,500 beads) or a 250 × 250 piece (62,500) is created, edited, saved, reloaded, exported and undone like any other.

What limits a Project is the device, and each was measured (with the CPU slowed 4×, a midrange tablet or a Core i3 laptop):

- **Speed.** Hover, paint, Selection drag and paste hover hold 60 fps up to 250 × 250; opening paints in about 140ms at 70 × 250 and 260ms at 250 × 250. Convert image's framing drag holds 38–60 fps in every Technique by drawing a coarse look while it moves; the New Project form warns that framing "may feel slow" from 12,000 beads, for the cost of the exact colors at rest. A pass on a real iPad Air 13″ is still to do.
- **Storage.** Compact storage ([ADR 0009](0009-compact-grid-encoding.md)) puts a 250 × 250 Project at 31KB painted in blocks of color and 136KB as random noise, the worst case: a library of about 35 of the noisiest. When a save doesn't fit, [ADR 0012](0012-saving-follows-the-pattern-library.md) applies unchanged.
- **Memory.** Undo snapshots are immutable and share structure ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)), so a stroke adds only what it changed; a Fill of a big area adds the most. Ticket 112 measured 40 whole-area Fills at 250 × 250 at about 128MB and judged it acceptable.

**Considered options**: raising the cap instead of removing it (rejected: there is no measured cliff to put it at, so any number is arbitrary); a warning instead of a refusal (rejected: nothing measured says a big Project hurts anyone; the framing hint, which has a measured reason, stays); refusing near a full device (rejected: ADR 0012's failed-save notice already says so when it is true).

**Consequences.** If a real device runs out of memory or storage with big Projects, a limit comes from a measurement, in a new ADR.
