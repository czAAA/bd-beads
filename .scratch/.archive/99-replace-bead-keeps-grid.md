# 99: Replace Bead keeps the grid

**What to build:** Swapping a Pattern's Bead no longer resamples anything. Columns, rows and every painted cell stay exactly as they are, whichever unit the Pattern was created in, and only the Estimated size changes. The confirmation says so in plain words. A Pattern also stops storing a millimetre size at all. Reasoning: [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), which supersedes ADR 0008; CONTEXT.md (Replace Bead).

**Blocked by:** 98 (Estimated size on the open Pattern), which supplies the estimate and its formatter

**Status:** done

- [ ] Replace Bead leaves the grid, columns, rows and colors untouched, with no rescale. Row progress and Mirror axis counts are no longer reset, since the grid they describe is unchanged
- [ ] It is still one undo step that restores the previous Bead, and still works on a painted Pattern
- [ ] The confirmation ("Replace bead?") replaces its "New size" line with the new Bead's Estimated size next to the current one, and says: what the size will be versus now, that the design and its bead count stay the same, and that rows and columns can be adjusted afterwards to get back to the size wanted. Suggested copy (EN): *With {bead}, this Pattern will be about **{new}** instead of **{old}**. Your design and its bead count stay exactly the same. If you'd like to get back to the size you had, you can add or remove rows and columns afterwards. You can undo this.* RU translation to match
- [ ] A Pattern no longer stores a real-world size. Creating a Pattern from an mm/cm size still derives its columns and rows once and keeps nothing else. Patterns saved before this change, and Pattern files exported before it, still load, and any stored mm fields are ignored
- [ ] The now-unused resampling helper and its tests are removed, unless something else uses it. Code comments that point to ADR 0008 point to ADR 0017 instead
- [ ] Tests cover: the grid, Row progress and Mirror surviving a swap for each pair of catalog Beads; undo restoring the Bead; and loading an old Pattern that still carries the mm fields
