# 305: Rotate keeps the Row progress pointer inside the Frame

**What to build:** Rotate turns the Frame a quarter turn, which swaps its columns and rows, but it doesn't keep the Row progress pointers (`currentRow`, `currentColumn`) inside the turned Frame the way `withFrame` does. `rotateProject` (`src/domain/rotate.ts`) builds `{ ...project, frame: turned }` itself and skips that clamp, and `setRowProgressEnabled` doesn't clamp either. Reproduction: on a 50 × 30 Frame (rows along the long side), move the pointer to row 40, switch Row progress off, Rotate, switch Row progress back on. The pointer is now past the Frame's last row, so every row reads as finished and drawing is locked across the whole Frame. Rotate must leave both pointers inside the turned Frame, using the same clamp `withFrame` uses. Found in the architecture review of 2026-10-05 (bug 1); the later "Edit entry point + Frame change" refactor (candidate D1) will make this rule structural, but this ticket is the plain fix with its regression test.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A failing test first reproduces the case above in `rotate.test.ts` (pointer beyond the turned Frame after Rotate) and passes after the fix
- [ ] After Rotate, `currentRow` and `currentColumn` both lie inside the turned Frame, for both Row directions
- [ ] Turning Row progress on after a Rotate never reports every row as finished
- [ ] Rotating back four times returns the same pointers whenever they were already inside both orientations (no needless clamping)
- [ ] Undo of the Rotate restores the previous pointers
