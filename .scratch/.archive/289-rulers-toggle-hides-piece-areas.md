# 289: The Rulers toggle also hides Piece area rectangles

**What to build:** Today the Rulers toggle (button, R, phone zoom pill) hides only the numbers and size markings; each Piece's rectangle line is drawn either way. With Rulers off, don't draw Piece area rectangles at all. The Frame's line is never hidden by the toggle (its numbers and size tooltip still hide, as today). With a Frame set nothing changes visually. Update the CONTEXT.md **Rulers toggle** wording (done in ticket 288's grill session) and the Rulers design card (README, `preview.html`, changelog line) in the same change; check the PNG/PDF export and the hover text/visual specs for Piece rectangles that now disappear. No ADR.

**Blocked by:** 288 (it names Piece areas; can be done first if the rectangle is still per Piece)

**Human involvement:** autonomous

**Status:** done

- [ ] Rulers off, no Frame: no Piece (area) rectangle and no numbers on the canvas; Rulers on: both, as before
- [ ] Rulers off, Frame set: the Frame's line is still drawn, its numbers and size tooltip are not
- [ ] The preference still persists on the device like the theme
- [ ] The Rulers card, its changelog line, and any visual reference images touched by the change are updated
