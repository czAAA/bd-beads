# Mirror is live while drawing, and is switched off until its redo

**Status: accepted; the feature is switched off.** Tickets 09, 44–50, 54, 174. Code catches up in ticket 365 (`MIRROR_ENABLED`).

Ticket 174 hid Mirror's controls pending a redesign; its domain code (`domain/mirror.ts`) and tests stay. Until the redo, the code does what is below. The redo starts from the first two points and may change the rest.

- **Mirror is live, not an Apply command.** With an axis on, a Paint stroke or a Paste lands at every mirrored place at once, as one Undo step. Fill, Eraser and Delete all ignore Mirror.
- **A one-time "Mirror current" stays** for what was drawn before an axis went on: the strip with the most beads is copied onto the others.
- Each direction has a count of axes (0 is off) that splits the area into equal strips; neighbouring strips are mirror images (A | A′ | A), or plain repeats in copy mode (A | A | A). Copy mode is a switch of its own, so stepping the count never changes what Mirror means. Counts follow the screen: Rotate swaps them. A Frame change resets them ([ADR 0036](0036-every-undoable-change-goes-through-edit.md)).

**Considered options**: a discrete Apply command, as ticket 09 first built it (rejected: the drawing only looks symmetric after the fact); a build flag guarding the old single-axis code (tried, then removed in ticket 54: it guarded a rollback that went stale, see [ADR 0041](0041-switched-off-features-live-in-features-ts.md) for when a flag is right).
