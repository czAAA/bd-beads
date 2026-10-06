# 314: Piece areas show only above 2x2

**What to build:** A Piece area's rectangle and rulers appear only when the area is larger than 2x2 beads (at least 3 wide and 3 tall), so a single bead, a pair or a small trio no longer gets a rectangle or rulers. The size is read after the one-bead margin and joining of Piece areas have been applied, so Pieces close together that join into a big enough area still show one. Small areas simply aren't drawn; beads and Pieces are unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A Piece area 2x2 or smaller (by its drawn rectangle) shows no rectangle and no rulers; 3x3 and larger show both
- [ ] Joined Piece areas are measured as the joined rectangle
- [ ] An area appears and disappears as beads are painted and erased across the threshold, with no flicker or stale rulers
- [ ] Line selection, Export, Beads needed and the Frame are unaffected
- [ ] CONTEXT.md (Piece area) records the minimum size
- [ ] Correct on phone through desktop
- [ ] Overview and Tour question (CLAUDE.md): not asked, Tour is off
