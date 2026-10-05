# 293: Piece areas join within one bead, and don't blink while you draw inside

**What to build:** Two fixes to Piece areas, shipped together.

1. **Join within one bead.** Today a Piece's rectangle only joins another Piece area when the two overlap, lie inside or touch. Pieces that sit close but not touching (for example beads in a triangle, each one bead apart diagonally or by a side gap) still get separate rectangles with their own rulers. Count each Piece's area as everything within one bead outside the Piece's own bounds, and join Piece areas whose rectangles overlap, lie inside or touch once that margin is included, repeated until none do. A cluster like that triangle becomes one Piece area: one rectangle, one set of rulers. Pieces with two or more empty beads between them stay separate. Forms, merges and splits as beads are painted and erased, as now.
2. **No blink.** Painting or erasing beads inside an existing Piece area makes its rectangle and rulers blink or flicker during the stroke. Drawing inside should leave them steady. When a stroke does change the Piece area (grows it, merges or splits Pieces), the rectangle goes straight to its new bounds with no blink in between, and an unaffected Piece area is never visibly redrawn. First reproduce it (which tool, which device, what blinks: the line, the rulers or both) and find the cause before changing anything; it may be one render path (e.g. the overlay cleared and redrawn per bead) rather than the grouping.

Update the CONTEXT.md **Piece area** wording and the Piece area / Rulers design card (README, `preview.html`, changelog line) in the same change; check the PNG/PDF export and the visual specs for rectangles that now merge or grow. No ADR unless the margin changes how Frame auto-fit or export bounds are chosen.

**Blocked by:** None (builds on the Piece-area grouping from ticket 288; if 288 hasn't landed, do it first)

**Human involvement:** needs a human to confirm whether the drawn rectangle itself grows by the one-bead margin, or only the rule for joining uses it (existing rectangles already pad each bead a little)

**Status:** ready-for-agent

- [ ] Beads in a triangle, each within one bead of the next, form a single Piece area: one rectangle, one set of column and row numbers
- [ ] Two Pieces with one empty bead between them join; with two or more empty beads between them they stay separate
- [ ] Painting a bead that bridges two Piece areas merges them; erasing it splits them again
- [ ] Peyote and brick stitch use the same one-bead margin (the half-bead row shift doesn't stop nearby Pieces joining)
- [ ] Drawing and erasing inside an existing Piece area, with and without a Frame: its rectangle and rulers don't blink during the stroke, on mouse and touch
- [ ] A stroke that grows, merges or splits Piece areas goes straight to the new rectangles with no blink
- [ ] A test (unit or visual) fails without the no-blink fix: the overlay for an unchanged Piece area isn't cleared and redrawn mid-stroke
- [ ] With a Frame set nothing changes visually; Rulers off still hides the rectangles; Select/Mirror overlays behave as before
- [ ] CONTEXT.md, the design card and its changelog line are updated; export and visual specs checked
