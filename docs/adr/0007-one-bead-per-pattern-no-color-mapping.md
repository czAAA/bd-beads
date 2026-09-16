# One Bead per Pattern: no color-to-bead mapping, fixed Bead catalog

[ADR 0002](0002-palette-separate-from-bead-catalog.md) resolved every Palette color to a real Bead through a global default mapping, overridable per Pattern, so the Bead quantities shopping list could name a Bead per color. Dropped (ticket 36): a Pattern is woven from exactly one Bead, chosen when it is created, so every color in it is that same Bead line and a per-color Bead adds bookkeeping without information. Bead quantities ("Beads needed") is now just the painted colors and their counts, listing only colors used at least once; the Pattern's single Bead is shown once, in the header (ticket 37). The global defaults and per-Pattern overrides are no longer stored or written to Pattern files; older files that carry them still import, with those fields ignored.

The Bead catalog also stops being user-editable (ticket 38): it is a fixed built-in list (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), and custom Beads are no longer loaded. With no per-color mapping, a Bead's only job is to set a new Pattern's cell shape and grid size, which the built-in lines cover. A Pattern created with a since-removed custom Bead keeps working, because its grid dimensions are stored on the Pattern itself; it just shows as an unknown Bead.

The rest of ADR 0002 still holds: a cell's color comes from the free-standing Palette and is not required to match a real Bead.

**Considered options**: keeping the mapping but hiding it from the Beads needed table (rejected — leaves stored data and a file-format field nothing reads); keeping custom Beads for the New Pattern picker only (rejected — no remaining need beyond the built-in lines, and it keeps a management UI alive for one dropdown).
