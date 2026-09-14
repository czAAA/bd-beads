# 07: Color-to-bead mapping and quantity calculation

**What to build:** A universal default mapping from each Palette color to one Bead, overridable per Pattern, plus a computed shopping list showing the total bead count needed per color for a given Pattern. See [ADR 0002](../../../docs/adr/0002-palette-separate-from-bead-catalog.md).

**Blocked by:** 03, 06

**Status:** ready-for-agent

- [ ] Each Palette color can have one global default Bead assigned (persisted across patterns)
- [ ] Within a specific Pattern, the default mapping for a color can be overridden without affecting the global default or other patterns
- [ ] For a given Pattern, the app computes and displays the total number of beads needed per color, based on painted cell counts
- [ ] The quantity view reflects the per-pattern override when one exists, otherwise the global default
