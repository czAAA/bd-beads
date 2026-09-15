# Mirror is live while drawing, not a discrete apply command

Ticket 09 built Mirror as a discrete command: paint freely, then trigger "Apply" to reflect the drawn half onto the rest of the grid, using whichever half held more painted cells as the source. Reversed: with the Paint tool active and a mirror axis toggle on, painting a cell now immediately paints its mirrored counterpart(s) too (2 cells for one axis, 4 for both), and there's no "Apply" command anymore. Making mirroring live required fixing the axis at the grid's exact center — a well-defined "other side" per stroke — which retires the old adaptive "bigger half" heuristic for this path. Mirror only applies to the Paint tool; Fill is unaffected by mirror state.

That heuristic wasn't dropped, though: it still runs behind two small "Mirror current (horizontal/vertical)" buttons that do a one-time reflect of whatever's currently painted, per axis. Live mirroring only handles strokes drawn after an axis is turned on — these buttons cover syncing up content that was already there.

**Considered options**: dropping the discrete apply behavior entirely once mirroring went live (rejected — live mirroring can't retroactively fix content painted before an axis was enabled, so the manual per-axis sync stayed for that case).
