# MirrorSizeControls

The Mirror and Frame disclosure rows opened in place, and the Estimated size warning. (The card keeps its v15 name.)

- A DisclosureRow opens in place, pushing what follows down; the chevron turns up. Each control is one line: Steppers for the axes, a Switch for Copy mode, two buttons for Mirror current.
- **Frame (v16, in Size's place; reworked in ticket 417):** Technique, then Edit Frame (primary), Fit to drawing and Remove Frame, then the Frame's Estimated size in the other unit ("≈ 4.5 × 3 cm") with its warning Note. It lives in the Pattern (Project) sheet. The Width and Height Steppers, the beads | mm switch (tickets 342, 410) and the side choice of ticket 410 are gone, and so is the applied-once pending size: the Frame's size is changed on the canvas, by dragging a handle or by the margin steppers on each edge (Frame card), each press one Undo step. With no Frame the sheet says what a Frame is and offers Fit to drawing; a Frame is also made from a Selection.
- While a Row progress pass is done, Edit Frame, Fit to drawing and Technique are locked and "Rows are marked done. Remove the Frame to change the size" is written under them. Remove Frame is not locked: it clears the passes with the Frame, after a confirmation (ticket 434).
- The estimate warning is the Tooltip at a 280px measure; on touch it opens on tap.

Hand-written from the Phase A sign-off (forms, screens and states) and the v16 sign-off; static rendition.
