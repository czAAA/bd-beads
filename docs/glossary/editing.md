# Glossary: Editing a Schema

Editing, sizing, counting and the clipboard and history. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Eraser**:
The 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: its primary press/tap erases a single bead under the pointer, dragging to erase a line, the same way right-click erase already worked (ticket 176 — renamed from "Erase" and switched from its original flood-erase primary behavior, so it works on touch/phone without needing a right-click). Behaves like every other drawing command — one undo step per stroke, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Right-click erase is still available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill) for erasing without switching tools; under Eraser itself, right-click is now redundant with the primary press. Its key is `4` (ticket 292; it was `E` from ticket 250). `Del` never picks the Eraser: it only empties the beads of the Selection.
_Avoid_: erase mode, clear tool

**Clear**:
Resets the open Project to how it was when first created at its size: every cell empty and Row progress's pointers back at the first row (it stays on with the Frame), after a confirmation. The Project's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: delete all, reset, wipe

**Schema size**:
How big a Schema is: its Frame's width × height, counted in beads (a Project with no Frame has no Schema size yet). It is set in the Frame section, in beads or mm (the unit is remembered on the device, not in the Project); a size in mm always rounds up to the next whole bead and is not remembered. A stepper press adds or removes one bead in either unit. Not limited in size beyond what the device can hold (see ADR 0019, which removed the cap ADR 0026 set).
_Avoid_: dimensions, resolution, physical size, columns × rows

**Rotate**:
Turns the Selection a quarter turn clockwise about its centre, on its layer (in the Frame the result is trimmed to the Frame, ticket 491); the turned rectangle becomes the Selection and the Frame is untouched (ADR 0052, which replaces the Frame turn of ADR 0026 and the view-only turn of ticket 171; both come back as their own controls, **Rotate Frame** and **Rotate canvas**, spec 0470, and this Rotate stays Selection-only). It is a drawing edit: beads under the turned footprint are replaced, one Message says how many were covered with Undo, and the keep-out margin and finished rows trim it silently. On peyote and brick stitch the turned top row snaps to an even row. Turning the whole drawing is Select all, Rotate, then Set Frame again. It sits on the Selection bar, and its key is `Shift+R`. Not offered once Row progress is on and a pass is done (ticket 411).
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
A Tools-group tool, next to Eraser, that removes the specific row or column the Selection marks out, from any index, shifting the beads after it to close the gap, as one undo step. With a Frame it acts on the Frame and shrinks it by one; with no Frame it acts on the Piece area the line belongs to, which ends one line shorter, with a new empty line outside it. Beads outside the Frame or Piece area stay where they are. Enabled only when the Selection is exactly one whole row or column of the Frame or Piece area (a drag with the Select tool across the whole Frame or Piece area makes one; a ruler number no longer does, ticket 447); refused while Row progress is on, which holds the Frame's rows still. Its key is `Shift+Del`; plain `Del` only empties the Selection's beads and never changes the Frame's size.
_Avoid_: delete row, delete column, shrink

**Replace Bead**:
Swaps a Project's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Schema size and every painted cell stay as they are, whichever unit the Project was created in — see ADR 0007.
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A paint color chosen freely with the Custom color picker, a wheel, a brightness slider and a hex field the app draws inside the colour popover under the Custom button. The picker only previews while it is open; leaving it (a press outside, Escape or Enter) takes the color once: it becomes the paint color and joins the Palette as a new swatch (unless its hex is already a swatch, or 28 have been added), and from then on it is an ordinary Palette swatch. Pressing an existing Palette swatch instead picks that swatch and takes nothing, and a picker opened and left untouched takes nothing. Cells keep the hex, so a Project opens with its colors on a device that lacks the swatch.
_Avoid_: user color, extra palette color, one-off color

**Selection**:
Always one rectangle of a Project's cells (ADR 0051, amended by ticket 414: it is not a set of beads, and there is no Lasso, no Point tool and no Add / Subtract). Three things make it: dragging with the Select tool, tapping a bead with the Piece tool (the bounding rectangle of that bead's Piece, which can hold beads of other Pieces too), or Select all (the Frame's inside when there is a Frame, else the rectangle round every placed bead); Shift+arrows from the keyboard cursor make the same rectangle. Whichever way it is made, it keeps out of the Frame's keep-out margin (tickets 428, 433, 0501). Ruler numbers are display-only (ticket 447): a press on one selects nothing and does what the active tool does at that spot, and the number has no hover or pointer cue. It is drawn as the rectangle's outer border in the Selection colour, with the Frame's eight handles (four larger ones on touch): dragging a handle resizes it, dragging inside moves the outline, and neither touches a bead. Its **Selection size** is its columns × rows in beads, shown at the left of the Selection bar, with its measured size, "12×8 · 4.2 × 2.6 cm" (say "Selection size", not "dimensions"). It survives switching between Select and Piece; choosing Paint, Fill or Hand drops it; Clear selection (Del) or choosing the Eraser empties every bead in it as one undo step. Exactly one is active at a time: a new drag or tap replaces the previous one, and leaving Select and Piece, switching or creating a Project, arming Paste (a Copy keeps it, ticket 415), or right-clicking the canvas or pressing Escape while nothing is copied clears it (an Escape with no Selection, paste preview or open disclosure left to dismiss switches to the Paint tool instead). It marks out cells, it does not change them — selecting never paints anything. Shift and Alt do nothing with a gesture. A Selection lives on one layer (ticket 491, ADR 0066): the one the drag or tap began on, drawn in that layer's geometry. A drag that begins in the Frame stops at its edge; one that begins on the Canvas does not step onto the Frame, whose cells are never part of a Canvas Selection. Cut, Copy, Fill, Clear selection and Rotate act on that layer only.
_Avoid_: region, highlighted area, selected block, set of beads, Lasso

**Piece tool**:
The Tools-group tool that selects a whole Piece with one tap, no dragging (ticket 414; the polygon icon, key `6`). Acts on the Canvas for a Canvas bead and on the Frame for a Frame bead (ticket 491; Name Piece is the Canvas's only, Pieces being Canvas concepts). Tapping a bead selects every bead that touches it by a side or a corner (the rule that makes a Piece, like Fill's reach); the Selection is the bounding rectangle of that Piece. Tapping empty space clears the Selection. With a Frame only the part of the Piece on the tapped bead's side counts (inside the Frame, or on the Canvas clear of its keep-out margin, ticket 433), trimmed to a legal rectangle; a tap on a bead in the margin is refused with the not-allowed cue; a tap on a bead with no Piece on that side changes nothing. Beads of other Pieces that fall inside the rectangle are inside the Selection too. Shares its Selection with Select: switching between the two keeps it.
_Avoid_: Lasso, Point tool, magic wand

**Select all**:
The Selection bar's first item (shown with the Select tool active, once a Selection exists) and Ctrl/⌘+A (ticket 428, ADR 0055; ticket 431 removed the Tool sheet tile and key `7`). The standalone Select all button at the canvas box's top-centre was removed with the Dock (ticket 439, ADR 0059): a touch-only user must first drag a Selection before the bar offers it (a Menu entry can be a later ticket). With a Frame it sets the Selection to the Frame's inside, on the Frame layer (always allowed, ticket 433); without one, to the bounding rectangle of every placed bead, on the Canvas layer (the box Fit to drawing finds). It makes Select the active tool; with no Frame and an empty canvas it does nothing.
_Avoid_: select everything

**Copy**:
Copies only the Selection's drawn beads (from its layer) into an in-session clipboard as bare row, column and colour, trimmed to their bounding box (empty cells inside stay holes), and arms paste mode at once (ticket 437, ADR 0057, reversing ticket 415): the Selection is cleared, the tool becomes Select and the first drawn bead (leftmost of the top row) is the anchor a stamp lands on the pointer's bead. A Selection with no drawn bead copies nothing and shows a Message. Cut arms paste mode the same way (ticket 447). The clipboard is an editing-session aid like the undo stack, never saved with the Project, but its own lifecycle is deliberately looser (see ADR 0016): it clears only when a new Copy replaces it or a new Selection is made, and survives a Project switch, a tool switch, and leaving paste mode.
_Avoid_: duplicate, clone

**Cut**:
Copy, then empty the Selection's beads, as one undo step (Ctrl/Cmd+X, the Selection bar's scissors; tickets 415, 447). Then, as Copy does, the Selection is cleared, the tool becomes Select and paste mode is on, so hovering previews the cut piece and a click stamps it. Acts on the Selection's layer and honours the Row progress lock and the keep-out margin like Clear selection.
_Avoid_: remove, move

**Fill (Selection)**:
The Selection bar's Fill: every position in the Selection, empty ones too, takes the current color on the Selection's layer (inside the Frame, only its own cells), as one undo step; the keep-out margin and finished rows trim it silently, as Paste (ticket 415). Not the Fill tool, which floods a region.
_Avoid_: paint selection

**Clear selection**:
Empties every bead of the Selection's layer in it as one undo step (Del, the Selection bar's last button; ticket 415). If the Selection holds every placed bead (Select all), it opens the Delete all confirmation and runs Delete all instead, so Row progress resets and no finished row is left behind. Not Clear, the Project sheet's whole-diagram wipe, though both end in the same confirmation when everything is selected.
_Avoid_: delete selection, empty selection

**Frame (from Selection)**:
The Selection bar's Frame: offered only when the Project has no Frame; makes the Frame the Selection's rectangle and lifts the Canvas beads inside it into the Frame, as one undo step; a named Piece it takes whole gives the Frame its name (tickets 415, 489, ADR 0066; Edit Frame follows in 417).

**Paste**:
Paste mode (ADR 0057) is on right after Copy or Cut: a click, or a click-and-drag (one stamp at the press point, never a Selection), stamps the copied block with its anchor bead on the clicked cell, as one undo step, and can be repeated until the clipboard is replaced or cleared; Ctrl/Cmd+V stamps at the cell under the pointer from any tool and re-arms paste mode. A stamp lands in the geometry of the layer under the pointer, Canvas to Frame and back alike (ticket 491); one landing in the Frame is clipped to it, and one Message says how many beads were clipped. The Canvas has no edge to clip to, and the block's empty cells are holes: they leave the destination's own color alone. While paste mode is on, hovering previews the block at every Mirror strip it would land in, and a click stamps all of those copies at once as a single undo step, honouring copy mode, each with its own hole rule. Select all is hidden. While the clipboard holds something there are two ways back in that stamp nothing (ticket 447): a **Paste** icon in the Selection bar, after Cut, and a **Paste** tool in the Tool pill right after Piece (key `7`); both only enter paste mode, and the tool shows as the lit one while it is on. They are absent while the clipboard is empty. Escape, right-click or another tool leaves paste mode and keeps the clipboard (on touch also Undo or a second tap on Select); a new Copy or Ctrl/Cmd+V re-arms it, and Shift+arrow leaves it and makes that Selection.
_Avoid_: place, insert, apply

**Undo**:
Steps the grid back to how it was just before the most recent step-worthy edit — a whole dragged Paint/erase stroke, a Fill, a Paste, a Frame change (Frame from Selection, an Edit Frame drag or stepper, a Move handle drag with its beads), Fit to drawing or Remove Frame (which brings the Frame back with its progress, and restores the Canvas beads it cleared), a Rotate, a Remove row/column, a Replace Bead, or a "Mirror current" — restoring it in full even where the edit has since been covered by Row progress's finished-row lock; Undo replays history rather than drawing, so the lock never blocks it. Row direction, moving the Row progress pointer, Select, and Copy are not edits and are never undo steps. An editing-session aid like the clipboard: never saved with the Project, and reset whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Z, except while typing in a form field.
_Avoid_: revert, step back

**Redo**:
Steps forward through whatever Undo has stepped back from, re-applying each undone edit in order; Undo and Redo can be alternated freely without losing or duplicating a step. A new edit that actually changes the grid clears it — the same edits that count as an Undo step in the first place, so one that lands on nothing (e.g. aimed only at finished rows) leaves it alone. Reset alongside Undo whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing in a form field.
_Avoid_: repeat, step forward
