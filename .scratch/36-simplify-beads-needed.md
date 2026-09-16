# 36: Beads needed shows only color and count

**What to build:** Beads needed becomes a plain shopping list for the open Pattern: one row per painted color, with a color swatch and how many beads of that color the Pattern needs, most-needed first. Colors painted nowhere are not listed. The color-to-bead mapping goes away entirely, because a Pattern is woven from a single Bead (shown in the header, ticket 37), so mapping each color to a Bead adds nothing.

- The "Bead used", "Default bead" and "This Pattern" columns and their pickers are removed.
- The global color-to-bead defaults stop being stored, and a Pattern's own color-to-bead overrides stop being stored.
- Pattern files stop writing the color-to-bead defaults. Files exported before this change still import: that field and any per-Pattern overrides in them are ignored.
- With no Pattern open, the box shows the existing "open a Pattern" message. With a Pattern open but nothing painted, it shows a short "nothing painted yet" line instead of an empty table.
- A painted color that isn't in the Palette (from an older imported file) is still listed with its swatch and count.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Only colors with a count of 1 or more are listed; zero rows are gone.
- The mapping is removed outright rather than hidden, including its stored data and its field in Pattern files.
- Recorded in ADR 0007 (already written, with an amendment note on ADR 0002): the Palette stays separate from the Bead catalog, but the color-to-bead mapping is dropped because a Pattern uses one Bead.

- [ ] Beads needed has exactly two columns: color swatch and bead count
- [ ] Only colors painted at least once are listed, ordered most-needed first
- [ ] Painting a new color adds its row; erasing its last cell removes the row
- [ ] No bead pickers or bead names appear in Beads needed
- [ ] With no Pattern open the "open a Pattern" message shows; with an unpainted Pattern a "nothing painted yet" line shows, in both languages
- [ ] Color-to-bead defaults and per-Pattern overrides are no longer saved, and leftover saved values don't break loading
- [ ] Exported Pattern and library files no longer contain color-to-bead defaults
- [ ] Files exported before this change (with defaults and overrides) still import correctly
- [ ] Translation strings used only by the mapping are removed from both languages
- [ ] CONTEXT.md's Bead quantities entry no longer mentions the mapping and links ADR 0007 instead of only ADR 0002
