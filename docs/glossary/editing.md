# Glossary: Editing a Schema

Editing, sizing, counting and the clipboard and history. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Eraser**:
The 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: its primary press/tap erases a single bead under the pointer, dragging to erase a line, the same way right-click erase already worked (ticket 176 — renamed from "Erase" and switched from its original flood-erase primary behavior, so it works on touch/phone without needing a right-click). Behaves like every other drawing command — one undo step per stroke, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Right-click erase is still available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill) for erasing without switching tools; under Eraser itself, right-click is now redundant with the primary press. Its key is `4` (ticket 292; it was `E` from ticket 250). `Del` never picks the Eraser: it only empties the beads of the Selection.
_Avoid_: erase mode, clear tool

**Clear**:
Resets the open Project to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Project's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: delete all, reset, wipe

**Schema size**:
How big a Schema is: its Frame's width × height, counted in beads (a Project with no Frame has no Schema size yet). It is set in the Frame section, in beads or mm (the unit is remembered on the device, not in the Project); a size in mm always rounds up to the next whole bead and is not remembered. A stepper press adds or removes one bead in either unit. Not limited in size beyond what the device can hold (see ADR 0019, which removed the cap ADR 0026 set).
_Avoid_: dimensions, resolution, physical size, columns × rows

**Rotate**:
Turns the Selection a quarter turn clockwise about its centre; the turned rectangle becomes the Selection and the Frame is untouched (ADR 0052, which replaces the Frame turn of ADR 0026 and the view-only turn of ticket 171). It is a drawing edit: beads under the turned footprint are replaced, one Message says how many were covered with Undo, and the keep-out margin and finished rows trim it silently. On peyote and brick stitch the turned top row snaps to an even row. Turning the whole drawing is Select all, Rotate, then Set Frame again. It sits on the Selection bar, and its key is `Shift+R`. Not offered once Row progress is on and a pass is done (ticket 411).
_Avoid_: flip, spin, orientation

**Beads needed**:
The count (and Estimated weight) of beads per color inside the Frame only; with no Frame it says "Set Frame to count beads." Beads outside the Frame are never counted.
_Avoid_: shopping list, bead count

**Estimated size**:
A Schema's width and height in mm/cm, worked out from its Schema size and Bead as one bead's size multiplied by the bead count, and never stored. Always presented as an estimate, since real work comes out a little different.
_Avoid_: real size, actual size, physical size

**Estimated weight**:
The grams of beads a Schema needs, per color and in total, shown in Beads needed: the bead count multiplied by an average weight of one bead of the Project's Bead, derived on the spot and never stored. Always presented as an estimate (an info tooltip says so and shows the average used), since real beads vary by color and finish. Hidden for a Bead with no weight. The per-bead weights are provisional until a dealer confirms them (ticket 155).
_Avoid_: real weight, exact weight

**Remove row/column**:
A Tools-group tool, next to Eraser, that removes the specific row or column the Selection marks out, from any index, shifting the beads after it to close the gap, as one undo step. With a Frame it acts on the Frame and shrinks it by one; with no Frame it acts on the Piece area the line belongs to, which ends one line shorter, with a new empty line outside it. Beads outside the Frame or Piece area stay where they are. Enabled only when the Selection is exactly one whole row or column of the Frame or Piece area (a ruler number selects one; see Selection); refused while Row progress is on, which holds the Frame's rows still. Its key is `Shift+Del`; plain `Del` only empties the Selection's beads and never changes the Frame's size.
_Avoid_: delete row, delete column, shrink

**Replace Bead**:
Swaps a Project's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Schema size and every painted cell stay as they are, whichever unit the Project was created in — see ADR 0007.
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A paint color chosen freely with the color picker in the Colors group. The first time it paints a cell it joins the Palette as a new swatch (unless its hex is already a swatch, or 28 have been added), and from then on it is an ordinary Palette swatch. Until it is used it is only the picker's current color, and choosing another replaces it. Cells keep the hex, so a Project opens with its colors on a device that lacks the swatch.
_Avoid_: user color, extra palette color, one-off color

**Selection**:
Always one rectangle of a Project's cells (ADR 0051, amended by ticket 414: it is not a set of beads, and there is no Lasso, no Point tool and no Add / Subtract). Three things make it: dragging with the Select tool, tapping a bead with the Piece tool (the bounding rectangle of that bead's Piece, which can hold beads of other Pieces too), or Select all (the rectangle round every placed bead); clicking a number on the row or column ruler, or Shift+arrows from the keyboard cursor, make the same rectangle. It is drawn as the rectangle's outer border in the Selection colour, with the Frame's eight handles (four larger ones on touch): dragging a handle resizes it, dragging inside moves the outline, and neither touches a bead. Its **Selection size** is its columns × rows in beads, shown at the left of the Selection bar, with its measured size, "12×8 · 4.2 × 2.6 cm" (say "Selection size", not "dimensions"). It survives switching between Select and Piece; choosing Paint, Fill or Hand drops it; Clear selection (Del) or choosing the Eraser empties every bead in it as one undo step. Exactly one is active at a time: a new drag or tap replaces the previous one, and leaving Select and Piece, switching or creating a Project, arming Paste (a Copy keeps it, ticket 415), or right-clicking the canvas or pressing Escape while nothing is copied clears it (an Escape with no Selection, paste preview or open disclosure left to dismiss switches to the Paint tool instead). It marks out cells, it does not change them — selecting never paints anything. Shift and Alt do nothing with a gesture. The keep-out margin cannot be selected (ticket 428): a drag with the Select tool that starts in it is refused (not-allowed pointer) and one that ends in it is clamped to the margin's edge, the Frame's own edge when it began inside the Frame.
_Avoid_: region, highlighted area, selected block, set of beads, Lasso

**Piece tool**:
The Tools-group tool that selects a whole Piece with one tap, no dragging (ticket 414; the polygon icon, key `6`). Tapping a bead selects every bead that touches it by a side or a corner (the rule that makes a Piece, like Fill's reach); the Selection is the bounding rectangle of that Piece. Tapping empty space clears the Selection. Beads of other Pieces that fall inside the rectangle are inside the Selection too. Shares its Selection with Select: switching between the two keeps it.
_Avoid_: Lasso, Point tool, magic wand

**Select all**:
A button on the Context bar, shown whenever the Select tool is active, even with no Selection, at the canvas box's top-centre (ticket 428, ADR 0055; also Ctrl/⌘+A, and for now still the tool-strip tile and key `7` of ticket 414). With a Frame it sets the Selection to the Frame's inside; without one, to the bounding rectangle of every placed bead (the box Fit to drawing finds). It makes Select the active tool; with no Frame and an empty canvas it does nothing.
_Avoid_: select everything

**Copy**:
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists. The Selection is kept (ticket 415, ADR 0051, reversing ticket 49), so it can still be cut, filled or cleared; Copy does not arm Paste. The clipboard is an editing-session aid like the undo stack, never saved with the Project, but its own lifecycle is deliberately looser (see ADR 0016): it clears only when a new Copy replaces it or a new Selection is made, and survives a Project switch, a tool switch, and cancelling out of Paste — none of which touch it anymore.
_Avoid_: duplicate, clone

**Cut**:
Copy, then empty the Selection's beads, as one undo step (Ctrl/Cmd+X, the Selection bar's scissors; ticket 415). The Selection is kept. Honours the Row progress lock and the keep-out margin like Clear selection.
_Avoid_: remove, move

**Fill (Selection)**:
The Selection bar's Fill: every position in the Selection, empty ones too, takes the current color, as one undo step; the keep-out margin and finished rows trim it silently, as Paste (ticket 415). Not the Fill tool, which floods a region.
_Avoid_: paint selection

**Clear selection**:
Empties every bead in the Selection as one undo step (Del, the Selection bar's last button; ticket 415). If the Selection holds every placed bead (Select all), it opens the Delete all confirmation and runs Delete all instead, so Row progress resets and no finished row is left behind. Not Clear, the Project sheet's whole-diagram wipe, though both end in the same confirmation when everything is selected.
_Avoid_: delete selection, empty selection

**Frame (from Selection)**:
The Selection bar's Frame: offered only when the Project has no Frame; sets the Frame to the Selection's rectangle, as one undo step (ticket 415; Edit Frame follows in 417).

**Paste**:
The Selection bar's Paste arms the clipboard: the Selection is discarded and a tap stamps the block, as many times as wanted. Stamps the copied block onto the grid with its top-left corner at the clicked cell (Select tool) or the cell under the pointer (Ctrl/Cmd+V, from any tool), as one undo step, and can be repeated at as many positions as wanted until the clipboard is replaced or cleared. A stamp reaching past the grid's edge is clipped silently rather than blocked or shifted, and the block's empty cells are holes: they leave the destination's own color alone instead of erasing it, so a motif stamped onto painted background doesn't punch through it. While a block is on the clipboard and Select is the active tool, hovering previews the block at every Mirror strip it would land in (not just under the pointer), and clicking stamps all of those copies at once as a single undo step, honouring copy mode; each copy keeps Paste's own hole rule independently. Only Select ever shows this live preview or treats a plain click as a stamp — Ctrl/Cmd+V pastes from any tool without needing one. Leaving Select, right-clicking the canvas, or pressing Escape no longer drops the clipboard: it only dismisses the live preview and the click-to-stamp behavior, which stays dismissed (even back on Select) until a new Copy or a new Selection re-arms it — Ctrl/Cmd+V keeps working on the dismissed clipboard regardless.
_Avoid_: place, insert, apply

**Undo**:
Steps the grid back to how it was just before the most recent step-worthy edit — a whole dragged Paint/erase stroke, a Fill, a Paste, a Frame change (Frame from Selection, an Edit Frame drag or stepper), Fit to drawing or Remove Frame, a Rotate, a Remove row/column, a Replace Bead, or a "Mirror current" — restoring it in full even where the edit has since been covered by Row progress's finished-row lock; Undo replays history rather than drawing, so the lock never blocks it. Row direction, moving the Row progress pointer, Select, and Copy are not edits and are never undo steps. An editing-session aid like the clipboard: never saved with the Project, and reset whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Z, except while typing in a form field.
_Avoid_: revert, step back

**Redo**:
Steps forward through whatever Undo has stepped back from, re-applying each undone edit in order; Undo and Redo can be alternated freely without losing or duplicating a step. A new edit that actually changes the grid clears it — the same edits that count as an Undo step in the first place, so one that lands on nothing (e.g. aimed only at finished rows) leaves it alone. Reset alongside Undo whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing in a form field.
_Avoid_: repeat, step forward
