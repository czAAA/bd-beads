# 299: Ruler dots between the numbers, selecting their row or column

**What to build:** The beads that have no number at the current Ruler step get a Ruler dot on the ruler, every 5th one bolder. Below about 6px of bead pitch, only the 5th-bead dots remain, so the ruler never turns into a solid line. A click or tap on a dot selects its whole row or column, like a number does, by the nearest bead under the pointer; that also makes a click on a number work at 10%, where a bead is about 2px. Use the glossary term Ruler dot (CONTEXT.md).

**Blocked by:** 298 (Zoom out to 10% on every screen, with the ruler numbers thinning).

**Status:** ready-for-agent

- [ ] Dots show for every bead without a number, in Piece rulers and Frame rulers, with every 5th bolder
- [ ] Under about 6px of bead pitch only the 5th-bead dots show
- [ ] Clicking a dot, or the ruler beside it, selects that row or column, from any tool, with the mouse, a finger and the Pencil
- [ ] Selecting by the ruler still lands on the right row and column at 10%
- [ ] Dots and numbers keep their contrast on all eleven Canvas colors
- [ ] Unit tests for dot drawing and the nearest-bead pick
