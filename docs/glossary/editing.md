# Glossary: Editing a Pattern

Editing, sizing, counting and the clipboard and history. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Eraser**:
The 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: its primary press/tap erases a single bead under the pointer, dragging to erase a line, the same way right-click erase already worked (ticket 176 — renamed from "Erase" and switched from its original flood-erase primary behavior, so it works on touch/phone without needing a right-click). Behaves like every other drawing command — one undo step per stroke, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Right-click erase is still available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill) for erasing without switching tools; under Eraser itself, right-click is now redundant with the primary press. Its key is `4` (ticket 292; it was `E` from ticket 250). `Del` never picks the Eraser: it only empties the beads of the Selection.
_Avoid_: erase mode, clear tool

**Clear**:
Resets the open Project to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Project's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: delete all, reset, wipe

**Pattern size**:
How big a Pattern is: its Frame's width × height, counted in beads (a Project with no Frame has no Pattern size yet). It is set in the Frame section, in beads or mm (the unit is remembered on the device, not in the Project); a size in mm always rounds up to the next whole bead and is not remembered. A stepper press adds or removes one bead in either unit. Not limited in size beyond what the device can hold (see [ADR 0019](../adr/0019-a-pattern-has-no-size-limit.md), which removed the cap ADR 0026 set).
_Avoid_: dimensions, resolution, physical size, columns × rows

**Rotate**:
Turns the Frame and the beads inside it a quarter turn about the Frame's centre (ADR 0026, which replaces the view-only turn of ticket 171). A Piece in the way moves clear of the Frame, with a Message and one Undo step. Its key is `Shift+R`. Disabled with no Frame or while Row progress is on, and its Tooltip says which.
_Avoid_: flip, spin, orientation

**Beads needed**:
The count (and Estimated weight) of beads per color inside the Frame only; with no Frame it says "Set Frame to count beads." Beads outside the Frame are never counted.
_Avoid_: shopping list, bead count

**Estimated size**:
A Pattern's width and height in mm/cm, worked out from its Pattern size and Bead as one bead's size multiplied by the bead count, and never stored. Always presented as an estimate, since a real piece comes out a little different.
_Avoid_: real size, actual size, physical size

**Estimated weight**:
The grams of beads a Pattern needs, per color and in total, shown in Beads needed: the bead count multiplied by an average weight of one bead of the Project's Bead, derived on the spot and never stored. Always presented as an estimate (an info tooltip says so and shows the average used), since real beads vary by color and finish. Hidden for a Bead with no weight. The per-bead weights are provisional until a dealer confirms them (ticket 155).
_Avoid_: real weight, exact weight

**Remove row/column**:
A Tools-group tool, next to Eraser, that removes the specific row or column the Selection marks out, from any index, shifting the beads after it to close the gap, as one undo step. With a Frame it acts on the Frame and shrinks it by one; with no Frame it acts on the Piece area the line belongs to, which ends one line shorter, with a new empty line outside it. Beads outside the Frame or Piece area stay where they are. Enabled only when the Selection is exactly one whole row or column of the Frame or Piece area (a ruler number selects one; see Selection); refused while Row progress is on, which holds the Frame's rows still. Its key is `Shift+Del`; plain `Del` only empties the Selection's beads and never changes the Frame's size.
_Avoid_: delete row, delete column, shrink

**Replace Bead**:
Swaps a Project's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Pattern size and every painted cell stay as they are, whichever unit the Project was created in — see [ADR 0007](../adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A paint color chosen freely with the color picker in the Colors group. The first time it paints a cell it joins the Palette as a new swatch (unless its hex is already a swatch, or 28 have been added), and from then on it is an ordinary Palette swatch. Until it is used it is only the picker's current color, and choosing another replaces it. Cells keep the hex, so a Project opens with its colors on a device that lacks the swatch.
_Avoid_: user color, extra palette color, one-off color

**Selection**:
A rectangular area of a Project's cells, marked out by dragging with the Select tool, or by clicking a number on the row or column ruler (which marks out that whole row/column and makes Select the active tool, so selecting a line is Select's job too), and left highlighted once made. Choosing Paint, Fill or Hand drops it; Del, or choosing the Eraser, empties every bead in it as one undo step. Exactly one is active at a time: a new drag or ruler click replaces the previous one, and leaving the Select tool, switching or creating a Project, making a Copy, or right-clicking the canvas or pressing Escape while nothing is copied clears it (an Escape with no Selection, paste preview or open disclosure left to dismiss switches to the Paint tool instead). It marks out cells, it does not change them — selecting never paints anything.
_Avoid_: region, highlighted area, selected block

**Copy**:
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists, and immediately clears the Selection highlight (the clipboard stays armed; copying the same block again requires reselecting it). The clipboard is an editing-session aid like the undo stack, never saved with the Project, but its own lifecycle is deliberately looser (see [ADR 0016](../adr/0016-clipboard-survives-pattern-and-tool-switches.md)): it clears only when a new Copy replaces it or a new Selection is made, and survives a Project switch, a tool switch, and cancelling out of Paste — none of which touch it anymore.
_Avoid_: duplicate, clone

**Paste**:
Stamps the copied block onto the grid with its top-left corner at the clicked cell (Select tool) or the cell under the pointer (Ctrl/Cmd+V, from any tool), as one undo step, and can be repeated at as many positions as wanted until the clipboard is replaced or cleared. A stamp reaching past the grid's edge is clipped silently rather than blocked or shifted, and the block's empty cells are holes: they leave the destination's own color alone instead of erasing it, so a motif stamped onto painted background doesn't punch through it. While a block is on the clipboard and Select is the active tool, hovering previews the block at every Mirror strip it would land in (not just under the pointer), and clicking stamps all of those copies at once as a single undo step, honouring copy mode; each copy keeps Paste's own hole rule independently. Only Select ever shows this live preview or treats a plain click as a stamp — Ctrl/Cmd+V pastes from any tool without needing one. Leaving Select, right-clicking the canvas, or pressing Escape no longer drops the clipboard: it only dismisses the live preview and the click-to-stamp behavior, which stays dismissed (even back on Select) until a new Copy or a new Selection re-arms it — Ctrl/Cmd+V keeps working on the dismissed clipboard regardless.
_Avoid_: place, insert, apply

**Undo**:
Steps the grid back to how it was just before the most recent step-worthy edit — a whole dragged Paint/erase stroke, a Fill, a Paste, a Set Frame, Fit to drawing or Remove Frame, a Rotate, a Remove row/column, a Replace Bead, or a "Mirror current" — restoring it in full even where the edit has since been covered by Row progress's finished-row lock; Undo replays history rather than drawing, so the lock never blocks it. Row direction, moving the Row progress pointer, Select, and Copy are not edits and are never undo steps. An editing-session aid like the clipboard: never saved with the Project, and reset whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Z, except while typing in a form field.
_Avoid_: revert, step back

**Redo**:
Steps forward through whatever Undo has stepped back from, re-applying each undone edit in order; Undo and Redo can be alternated freely without losing or duplicating a step. A new edit that actually changes the grid clears it — the same edits that count as an Undo step in the first place, so one that lands on nothing (e.g. aimed only at finished rows) leaves it alone. Reset alongside Undo whenever the open Project changes. Available anywhere in the editor via Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing in a form field.
_Avoid_: repeat, step forward
