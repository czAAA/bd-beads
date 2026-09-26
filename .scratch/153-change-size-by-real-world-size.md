# 153: Change size by real-world size (beads, mm or cm) with a confirmation

**What to build:** A "Change size…" button in the Size group opens a modal that lets a Pattern's size be set in beads, mm or cm on an open Pattern. This fixes a Pattern that was created at the wrong size, for example 160 × 30 beads that were meant to be 160 × 30 mm. The modal has a unit picker (beads / mm / cm) and two numbers (columns/width and rows/height), pre-filled with the current grid. The numbers can be kept and only the unit switched, or edited. A live message states what will happen, for example "160 × 30 beads will become 160 × 30 mm ≈ 106 × 14 beads", using the Pattern's Bead and the same mm/cm-to-grid conversion the New Pattern form uses. Confirming resizes the grid as one undo step; cancelling changes nothing. The mm/cm size is converted once and forgotten, as in [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md); the Pattern still stores only its grid.

Prefactor first: if the mm/cm-to-grid conversion is not already a shared function, make it one so the New Pattern form and this modal call the same code.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Size group has a "Change size…" button, disabled while Row progress is on (the same lock Resize respects), with the reason available on hover and keyboard focus
- [ ] The modal offers beads, mm and cm; the numbers start as the current columns × rows, and switching the unit keeps the numbers as typed
- [ ] The message updates as the unit or numbers change and always names the before and after in the chosen unit and in beads (for example "160 × 30 beads will become 160 × 30 mm ≈ 106 × 14 beads"); for a beads-to-beads change it reads as a plain "160 × 30 → 100 × 30 beads"
- [ ] When the new grid is smaller in either direction, the message also says that painted cells outside it will be removed; this is only a message, with no extra tick required
- [ ] Growing adds empty rows/columns; shrinking keeps the top-left of the grid (an anchor choice is out of scope)
- [ ] Confirm applies the new grid as one undo step, and Mirror axis counts reset because grid dimensions changed, as after Resize today; Cancel and Escape close the modal with the Pattern unchanged
- [ ] Invalid input (empty, zero, negative, not a number) disables Confirm and says why; there is no upper limit on size ([ADR 0019](../docs/adr/0019-a-pattern-has-no-size-limit.md))
- [ ] The modal follows DESIGN.md's modal template and tokens in both themes, and all copy is available in EN and RU
- [ ] Tests cover the conversion for all three catalog Beads (including TOHO Round 11/0's width correction), growing, shrinking, the Row progress lock, undo, and the message text
- [ ] CONTEXT.md (Resize, Pattern size) and ADR 0017 note that an mm/cm size can be applied to an open Pattern and is still converted once and forgotten
