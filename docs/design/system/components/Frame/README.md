# Frame

The rectangle that marks which beads are the Pattern: set over the open canvas before or after drawing, and required for Export, Row progress and Rotate.

- **One Frame per canvas, and it never limits drawing.** Beads outside it stay on the saved canvas, stay editable, and can be exported later by moving the Frame over them.
- **Line:** 1.5px `ink`, radius 7, 7px outside the outermost beads, so the current-row marker (3px outside) sits inside it. No fill, and nothing outside is dimmed.
- **Set Frame:** from the Frame row in the Toolbox, the Set Frame button in the Progress bar or the export prompt, or `F`. Drag on the canvas; the Frame snaps to whole beads. Eight handles resize it (9px, 1.5px `ink`, radius 2, filled with the canvas background), and a Tooltip at its bottom-right corner shows the size: "13×13 · 2.1 × 2.1 cm". On touch: four 16px corner handles, and the ContextBar holds the size, Fit to drawing and Done.
- **Frame row:** the DisclosureRow that takes Size's place in the Toolbox. Closed: the `frame` icon, "Frame", then "not set", or the Frame number and the measured size. Open: Columns and Rows Steppers, Fit to drawing (frames every bead on the canvas) and Remove Frame.
- **Frame number:** a 22px chip ("1"; DM Mono 12 on `elevated`, 1px `line-strong`, radius 6) in the Frame row. Pressing it brings the Frame into view. Name: "Frame 1, bring it into view".
- **Once set:** inside it, empty positions draw as full `bead-empty` beads. Piece rulers hide and the Frame's rulers show on all four sides (Rulers card). The header reads "Star · 21×19" and the canvas strip "21 columns · 19 rows · 3.4 × 3.0 cm". Beads needed and Row progress count the Frame only.
- **What needs a Frame:** Export, Row progress (Row done, Row not done) and Rotate. Without one, Export ▾ opens "Set Frame to export" (SaveBox card), the Progress bar shows "Set Frame to start" with a Set Frame button, and Rotate is disabled and named "Rotate, Set Frame first".
- **Rotate** turns the Frame and its beads a quarter turn about the Frame's centre. If the turned Frame would cover a piece outside it, that piece moves to the nearest empty space clear of the Frame and its rulers, and a Message says "Pattern rotated. 1 piece was in the way and moved outside the Frame." with Undo.
- **Export** takes only the beads inside the Frame. PNG and PDF never draw the Frame line.
- **Naming:** the action is always "Set Frame". "Frame" alone names the thing, the Toolbox row and the Dock button.
- The consumer provides the Frame's position and size in beads, the Bead's size for the measured size, and whether the Frame is being set.

Hand-written from the v16 sign-off (open canvas mockups); static rendition. Left: being set. Right: set, with row 6 current and a piece left outside.
