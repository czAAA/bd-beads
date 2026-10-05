# 288: Piece rectangles merge into one Piece area

**What to build:** With no Frame, a Piece's rectangle that overlaps, lies inside or touches (the cell ring directly around it, side or corner, by the Technique's own neighbour geometry, as Pieces already do) another's joins it, repeated until none do, so one **Piece area** (CONTEXT.md) is drawn per merged group instead of a big box with many small boxes inside or against it. The area's rectangle is the union's bounding box; its rulers number from 1 across the whole area; a ruler number selects that row or column across the whole area; the highlighted rectangle for the piece being drawn (`activePiece`) becomes the area containing it. Areas form, merge and split live as beads are painted and erased, cached per set of beads like `piecesOf`. A Piece itself (touching beads) stays as is. Update the Rulers design card (README, `preview.html`, changelog line) in the same change. No ADR.

**Blocked by:** none

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] A large Piece with smaller Pieces inside its rectangle, or against it side or corner, draws one rectangle and one set of numbers (the case in the report: a staircase Piece with single beads and a plus shape inside)
- [ ] Merging is transitive: a small area that joins a big one pulls in whatever then overlaps or touches the grown rectangle
- [ ] Rectangles with a gap of at least one empty cell between them stay separate
- [ ] Painting or erasing re-forms the areas (merge and split), on loom, peyote and brick stitch
- [ ] Ruler numbers, ruler-click selection and the active-piece highlight use the Piece area; unit tests cover the merge rule per Technique
- [ ] The Rulers card and its changelog line are updated
