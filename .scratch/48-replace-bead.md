# 48: Replace Bead — swap and recalculate a Pattern's bead

**What to build:** A "Replace bead" control sits next to wherever the Pattern's current Bead is shown. Clicking it offers the other built-in catalog Beads to switch to. Picking one opens a confirmation modal (styled like the app, not the browser's `confirm()`) naming what will change: the new grid size, that colors will be rescaled to fit it, and that Row progress and Mirror will reset. Cancel or Escape leaves the Pattern untouched.

Confirming swaps the Pattern's Bead and recalculates: the Pattern's real-world size (mm) stays fixed, so columns/rows are recomputed from the new Bead's footprint using the same math ticket 01 uses at creation. Existing colors are rescaled onto the new grid by proportional nearest-cell resampling rather than cropped, approximating the same design at the new resolution. Row progress turns off with both direction pointers back at the first row, and Mirror axis counts reset to 0 in both directions, since both are defined against a grid that may no longer exist. The whole thing — bead swap, grid resize, color rescale, and the two resets — is one undo step. Available on Patterns with painted cells as well as empty ones.

**Blocked by:** None (can start immediately) — tickets 36-39 have already shipped, so the fixed 3-bead catalog and single-bead-per-pattern model this ticket needs are already in place

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Glossary: **Replace Bead** (RU: Заменить бисер) — see CONTEXT.md, and [ADR 0008](../docs/adr/0008-replace-bead-recalculates-grid.md).
- Real-world size stays fixed; columns/rows recalculate from the new Bead's footprint via `computeGridDimensions` (ticket 01), not the reverse.
- Existing colors are rescaled by proportional nearest-cell resampling — not cropped, not blocked outright.
- Row progress resets to the first row with nothing locked; Mirror axis counts reset to 0 — see the amendment notes this ticket adds to CONTEXT.md's Row progress and Mirror entries.
- One undo step restores the Pattern exactly as it was before the swap (grid, colors, Row progress, Mirror axes together).
- Confirmation modal follows the same pattern as Delete all (ticket 42): in-app, Cancel/Escape cancels cleanly.
- Available whether or not the Pattern has been painted on — the motivating case is exactly a Pattern someone already started.
- Originally sequenced after tickets 36-39 (fixed 3-bead catalog, single-bead-per-pattern cleanup) — those have since shipped, so this is unblocked.

- [ ] A "Replace bead" control appears next to wherever the Pattern's current Bead is shown
- [ ] Clicking it offers the other built-in catalog Beads to switch to
- [ ] Picking a Bead opens a confirmation modal naming the new grid size, that colors will be rescaled, and that Row progress/Mirror will reset; Cancel or Escape leaves the Pattern untouched
- [ ] Confirming updates the Pattern's Bead, recalculates columns/rows from real-world size + new footprint, and rescales existing colors onto the new grid
- [ ] Row progress turns off with both direction pointers at the first row
- [ ] Mirror axis counts reset to 0 in both directions
- [ ] Works on Patterns with painted cells and on empty Patterns alike
- [ ] One Undo restores the exact previous grid, colors, Row progress and Mirror axes
- [ ] Modal and control labels are translated
