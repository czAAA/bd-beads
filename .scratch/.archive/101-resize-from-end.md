# 101: Resize from the end

**What to build:** On an open Pattern, the user can add or remove rows and columns from the Size group, at the right and bottom as seen on screen. Removing them removes the beads painted on them, and one undo brings everything back. It exists because Replace Bead no longer recalculates the grid (ticket 99): someone who swaps to a bigger bead needs a direct way to get back to the size they want. Terms: CONTEXT.md (Resize); [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md).

**Blocked by:** 98 (Estimated size on the open Pattern), which supplies the Size group; 100 (New Pattern form: beads by default, with the cap), which supplies the cap constant and its message wording

**Status:** done

- [ ] The Size group gains a columns input and a rows input (each at least 1, whole numbers) showing the Pattern's current counts, with the Estimated size updating live as they change
- [ ] Directions are as seen on screen: when the Pattern is rotated the two inputs swap, the way Mirror's counts do
- [ ] Growing adds empty cells at the right/bottom. Shrinking removes the last columns/rows and any painted cells on them, with no confirmation, since it is one undo step that restores everything
- [ ] Growing past the 10,000-cell cap is refused with the same message wording as the New Pattern form. Shrinking, and any change on a Pattern already over the cap that does not make it larger, is always allowed. Opening a Pattern over the cap is never blocked
- [ ] The whole Size group's inputs are disabled while Row progress is on, with a short reason on hover ("Turn off Row progress to change the size"), and re-enable when it is turned off
- [ ] A Resize is one undo step (grid and dimensions together) and Redo re-applies it. It clears the Selection and resets Mirror axis counts, like any change to grid dimensions. A Resize that changes nothing is not an undo step
- [ ] Peyote and brick stitch keep their stagger correct after any change from the end (row parity is unaffected)
- [ ] Both EN and RU strings
- [ ] Tests cover growing and shrinking for loom and peyote, dropped cells being restored by Undo, the cap boundary, an over-cap Pattern still shrinking, the Row progress lock, the rotated swap, and the Selection and Mirror resets
