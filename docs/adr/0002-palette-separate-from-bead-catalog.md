# Palette is separate from the bead catalog

A Pattern cell's color is drawn from a free-standing Palette, not required to match a real Bead in the catalog — this was chosen over tying every cell directly to a specific catalog entry, so patterns can be drawn/colored freely without first cataloging every bead that might be used. For the bead-quantity shopping list, each palette color resolves to a real Bead through one universal global default mapping (e.g. "red" always means one specific bead), independent of which bead a given pattern actually uses, overridable per-pattern when that pattern's real bead differs from the default.

**Considered options**: mapping the default bead per color scoped to the bead line/brand in use (rejected — adds bookkeeping for a single-user tool where the per-pattern override already covers mismatches).
