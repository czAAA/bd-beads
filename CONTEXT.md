# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Patterns (hand weaving and loom weaving).

## Quick start

- **Issue tracker**: `.scratch/` (local markdown)
- **Architecture decisions**: `docs/adr/`
- **Agent skills config**: `docs/agents/`

## What is this app?

bd-beads lets a single user design beadwork Patterns for hand weaving (peyote, brick stitch) and loom weaving: set a Pattern's size in beads (or mm/cm, converted once to beads), paint it using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product, today — see [ADR 0001](docs/adr/0001-local-only-persistence.md); [ADR 0014](docs/adr/0014-mvp-stays-local-only-hosted-phase-deferred.md) lays out the planned hosted phase and why it's deliberately not part of this release.

## Key concepts

- **Pattern**: a saveable, re-editable grid design (see Language below)
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md), amended by [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md) (dropped the color-to-bead mapping; a Pattern now has exactly one Bead)
- **Technique**: determines a Pattern's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Pattern size**: the grid's columns × rows in beads; the mm shown is only an estimate, and Replace Bead keeps the grid — see [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), which supersedes [ADR 0008](docs/adr/0008-replace-bead-recalculates-grid.md). There is no limit on size beyond what the device can hold ([ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cell cap)
- **Bead quantities**: the per-color bead counts a Pattern needs, counted straight from its painted colors — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md)
- **Pattern file**: the exported `.json` holding one Pattern or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **Convert image**: a second way to create a Pattern — from a picture rather than an empty grid, cropped to the Pattern's real-world size ([ADR 0010](docs/adr/0010-convert-image-fixed-physical-size.md), amended by [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md)) with its colors saved as Image colors ([ADR 0011](docs/adr/0011-image-colors-stored-frozen.md))
- **Visual language**: how the app looks — light and dark themes, tokens, layout and components — is set by [DESIGN.md](DESIGN.md), see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md). Its layout replaces the App shell layout below as the redesign tickets land; until then the entry below describes the app as built
- **App shell layout**: a top bar plus the panels below it (a left column, the canvas, and a below-canvas panel) that new UI must fit into; the left column holds the New Pattern form when no Pattern is open (or during Convert image framing) and the Toolbox rail otherwise, the top bar's summary box holds the open Pattern's info alongside New Pattern and the Import controls, zoom floats over the canvas panel's top-right corner (fixed to the panel, not to the Pattern's own sized box inside it), Progress bar sits beside or above the open Pattern depending on its Pattern shape, and the below-canvas panel is two boxes, Beads needed and Saved Patterns (which also holds the file exports) — see [ADR 0004](docs/adr/0004-three-panel-app-shell.md) and [ADR 0005](docs/adr/0005-tools-above-canvas.md) before adding a new screen or control

## Language

**Pattern**:
A saveable, re-editable beadwork design: a grid of cells (shape depends on the chosen technique and bead form factor), each cell painted with a color from the palette.
_Avoid_: design, drawing, chart

**Pattern library**:
Every Pattern saved on this device, taken together — what the Saved Patterns box lists and what a library Pattern file exports in one go. It is a flat set with no ordering, grouping or nesting: a Pattern belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Pattern file. Saves itself as it changes, so the Toolbox's Save only reassures on the device side: it writes at once and says "Saved", or says so if the device refuses (ticket 115). Save also hands over the open Pattern as a Pattern file, so a Pattern can be opened on another device without a separate Export (ticket 119). Every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in the top bar and keeps the change on screen rather than losing it silently. See [ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md).
_Avoid_: collection, gallery, saved list, workspace

**Palette**:
A free-standing set of colors used to paint pattern cells. Independent from the bead catalog — a cell's color is not required to correspond to a real bead.
_Avoid_: color scheme

**Bead**:
A catalog entry for a specific real bead: brand, name, size, form factor, and color (e.g. Miyuki Delica 11/0), plus its physical footprint in mm (used to convert an mm/cm size into a grid when a Pattern is created, and to work out an Estimated size — see ticket 01). Width runs along the thread (the bead's length through its hole) and height across it (its diameter), so TOHO Round 11/0 is 1.5 × 2.2mm, not a 2.2mm ball. A Bead may carry a per-bead width correction (mm added to each column for thread and slack, measured rather than published — currently 0.15mm on TOHO Round 11/0), so a column is `widthMm + widthCorrectionMm` wide. The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: seed bead type, item

**Form factor**:
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a pattern cell.
_Avoid_: bead shape

**Technique**:
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a pattern's cells. A pattern has exactly one technique and one bead catalog entry for its entire grid.
_Avoid_: stitch, weave type

**Row progress**:
An overlay toggled on top of the pattern editor (not a separate mode) that tracks which rows have already been woven: a sequential "current row" pointer, movable backward, with finished rows shown dimmed, the current row distinctly highlighted, and remaining rows in normal colors. While it's on, finished rows are locked: no drawing command (Paint, erase, Fill, Paste, Mirror) changes them, though Undo still restores an earlier grid in full. Delete all is the exception: it clears Row progress along with the grid. Not changeable by Resize while on. Saved together with the pattern. Its Toolbox group holds the Enabled and Direction toggles; its moment-to-moment controls — the pointer readout and the buttons that move it — live on the canvas instead, as Progress bar.
_Avoid_: progress bar (as a name for this overlay/mechanic — it isn't a fill/percentage visualization, which is exactly what "Progress bar" is reserved for instead, see Progress bar), completion state

**Row direction**:
Which way the weaver's rows run across a Pattern's grid for Row progress: along the grid's rows, or down its columns. Each direction keeps its own current-row pointer. Independent of rotating the Pattern, which only turns the picture on screen: after rotating, the weaver flips Row direction too, but neither ever changes the other.
_Avoid_: progress orientation, row rotation

**Pattern shape**:
Whether a Pattern's rendered grid box is taller than it is wide (vertical: rendered width < height) or not (horizontal: width ≥ height, including square). Measured from the rendered box — a technique's own row packing (e.g. peyote's tighter rows) and Rotate both affect it — never from raw column/row counts. Independent of Row direction and Rotate: none of the three ever changes another. Decides where Progress bar sits.
_Avoid_: orientation (ambiguous with Row direction, which has the same avoidance for the same reason), aspect ratio

**Progress bar**:
The small control that puts Row progress's moment-to-moment actions on the canvas itself: a "row X of Y" readout plus Previous/Next buttons that move the current-row pointer. Positioned by Pattern shape: its own `position: sticky` column on the canvas panel's right edge for a vertical Pattern, its own `position: sticky` row stacked below (not merged with) the zoom cluster for a horizontal one — sticky either way, so it stays reachable while scrolling a tall Pattern regardless of which shape it is. Reserves no space and shows nothing while Row progress is off. Separate from the Row progress marker already drawn on the grid (the current-row outline) and from the Toolbox's Row progress group (which keeps the Enabled and Direction toggles).
_Avoid_: progress control, row control

**Mirror**:
A symmetric-drawing aid for a Pattern. Each direction (left–right and top–bottom) has its own count of Mirror axes, from 0 (off) up to one fewer than the cells across that direction. N axes split the grid into N+1 equal strips (an axis may run through the middle of a cell, which then mirrors onto itself); painting a cell with the Paint tool also paints its counterpart in every other strip. By default neighbouring strips are mirror images of each other (A | A′ | A); a copy mode, one switch for both directions, instead repeats the strip unflipped (A | A | A). Directions are as seen on screen, so rotating the Pattern swaps the two counts. Axes are drawn as faint lines on the canvas while either count is above 0. A separate "Mirror current" action per direction does a one-time sync of what's already painted, copying the strip with the most painted cells onto the rest (1 center axis if that direction's count is 0), honouring copy mode; hovering it shows the axes and dims the cells it would overwrite. Axis counts and copy mode are an editing-session setting, reset when switching Patterns or when a Resize changes grid dimensions. Fill and Delete all are not affected by Mirror; Paste now is — see Paste.
_Avoid_: reflect, symmetry mode, apply mirror

**Toolbox**:
The fixed-width rail of editing controls down the left of the app shell while a Pattern is open (no wider than 200px, thinner on a tablet), made up of Tool groups stacked vertically. Takes the left column in turn with the New Pattern form. Stays pinned near the top of the viewport while the canvas is in view, so it stays reachable while working on the lower rows of a Pattern taller than the screen, and un-pins once the canvas has scrolled past.
_Avoid_: tool strip, toolbar, above-canvas panel

**Tool group**:
One titled box within the Toolbox gathering related controls — e.g. Tools (Paint, Fill, Select, Erase), Colors, Edit (including Save, QR export and PNG and PDF export), Mirror, Size, Row progress. Lays its controls out four to a row (three on a tablet) and holds at most 16 in view (four rows of four); a group with more shows that it has more and expands in place, downward, while the pointer is inside it.
_Avoid_: subbox, card, section, panel

**Erase**:
A 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: clicking a painted cell flood-erases its connected same-color region, reusing Fill's own flood algorithm but writing empty instead of a color. Behaves like every other drawing command — one undo step, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Separate from the existing right-click erase available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill), which this tool doesn't change.
_Avoid_: eraser mode, clear tool

**Delete all**:
Resets the open Pattern to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Pattern's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: clear, reset, wipe

**Pattern size**:
How big a Pattern is: its columns × rows, counted in beads. A size given in mm/cm is converted to whole beads when the Pattern is created and not remembered. Not limited in size beyond what the device can hold (see [ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cap ADR 0017 set).
_Avoid_: dimensions, resolution, physical size

**Estimated size**:
A Pattern's width and height in mm/cm, worked out from its Pattern size and Bead as one bead's size multiplied by the bead count, and never stored. Always presented as an estimate, since a real piece comes out a little different.
_Avoid_: real size, actual size, physical size

**Resize**:
Adding or removing one whole row/column at a time on an open Pattern, from either end of each direction, via −/+ buttons on the Size group's columns/rows counts (not a typeable number); removing them removes the beads painted on them. Not available while Row progress is on.
_Avoid_: crop, stretch, scale, change grid

**Remove row/column**:
A Tools-group tool, next to Erase, that removes the specific row or column the Selection marks out — any index, not just an end the way Resize is limited to — shifting the rest of the grid to close the gap, as one undo step. Enabled only when the Selection is exactly one whole row or column (see Selection); refused while Row progress is on, the same lock Resize itself respects.
_Avoid_: delete row, delete column, shrink

**Replace Bead**:
Swaps a Pattern's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Pattern size and every painted cell stay as they are, whichever unit the Pattern was created in — see [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), superseding [ADR 0008](docs/adr/0008-replace-bead-recalculates-grid.md).
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A one-off paint color chosen freely with the color picker in the Colors group, outside the Palette. Not added to the Palette and not remembered: choosing another Custom color replaces it. Cells painted with it keep that color and show up in Bead quantities like any other color.
_Avoid_: user color, extra palette color

**Selection**:
A rectangular area of a Pattern's cells, marked out by dragging with the Select tool, or by clicking a number on the row or column ruler (which marks out that whole row/column, from any tool), and left highlighted once made. Exactly one is active at a time: a new drag or ruler click replaces the previous one, and leaving the Select tool, switching or creating a Pattern, making a Copy, or right-clicking the canvas or pressing Escape while nothing is copied clears it. It marks out cells, it does not change them — selecting never paints anything.
_Avoid_: region, highlighted area, selected block

**Copy**:
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists, and immediately clears the Selection highlight (the clipboard stays armed; copying the same block again requires reselecting it). The clipboard is an editing-session aid like the undo stack, never saved with the Pattern, but its own lifecycle is deliberately looser (see [ADR 0016](docs/adr/0016-clipboard-survives-pattern-and-tool-switches.md)): it clears only when a new Copy replaces it or a new Selection is made, and survives a Pattern switch, a tool switch, and cancelling out of Paste — none of which touch it anymore.
_Avoid_: duplicate, clone

**Paste**:
Stamps the copied block onto the grid with its top-left corner at the clicked cell (Select tool) or the cell under the pointer (Ctrl/Cmd+V, from any tool), as one undo step, and can be repeated at as many positions as wanted until the clipboard is replaced or cleared. A stamp reaching past the grid's edge is clipped silently rather than blocked or shifted, and the block's empty cells are holes: they leave the destination's own color alone instead of erasing it, so a motif stamped onto painted background doesn't punch through it. While a block is on the clipboard and Select is the active tool, hovering previews the block at every Mirror strip it would land in (not just under the pointer), and clicking stamps all of those copies at once as a single undo step, honouring copy mode; each copy keeps Paste's own hole rule independently. Only Select ever shows this live preview or treats a plain click as a stamp — Ctrl/Cmd+V pastes from any tool without needing one. Leaving Select, right-clicking the canvas, or pressing Escape no longer drops the clipboard: it only dismisses the live preview and the click-to-stamp behavior, which stays dismissed (even back on Select) until a new Copy or a new Selection re-arms it — Ctrl/Cmd+V keeps working on the dismissed clipboard regardless.
_Avoid_: place, insert, apply

**Undo**:
Steps the grid back to how it was just before the most recent step-worthy edit — a whole dragged Paint/erase stroke, a Fill, a Paste, a Replace Bead, or a "Mirror current" — restoring it in full even where the edit has since been covered by Row progress's finished-row lock; Undo replays history rather than drawing, so the lock never blocks it. Rotate, Row direction, moving the Row progress pointer, Select, and Copy are not edits and are never undo steps. An editing-session aid like the clipboard: never saved with the Pattern, and reset whenever the open Pattern changes. Available anywhere in the editor via Ctrl/Cmd+Z, except while typing in a form field.
_Avoid_: revert, step back

**Redo**:
Steps forward through whatever Undo has stepped back from, re-applying each undone edit in order; Undo and Redo can be alternated freely without losing or duplicating a step. A new edit that actually changes the grid clears it — the same edits that count as an Undo step in the first place, so one that lands on nothing (e.g. aimed only at finished rows) leaves it alone. Reset alongside Undo whenever the open Pattern changes. Available anywhere in the editor via Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing in a form field.
_Avoid_: repeat, step forward

**Convert image**:
Creating a Pattern from a picture instead of an empty grid: the picture is shown rendered as beads, and a frame — the Pattern itself, sized by its physical dimensions, Bead and Technique — is positioned over it to choose which part is kept. What falls inside the frame is resampled onto the Pattern's grid and its colors become the Pattern's Image colors. A way of creating a Pattern only, never a command that converts into one already open.
_Avoid_: import image, trace, pixelate, image import

**Image colors**:
The set of colors one Convert image produced, saved with that Pattern and offered alongside the Palette while it is open. Frozen at the moment of conversion: painting a new color never adds to it and erasing one never removes it, because it records what the conversion found rather than what the Pattern currently holds. A Pattern created any other way has none.
_Avoid_: extracted palette, pattern palette, image palette, pattern colors

**Pattern renderer**:
The one thing that draws a Pattern's cells — for the editor, the Convert image preview and the exports — so a bead looks the same wherever it appears. Draws whatever part of the Pattern is in view, at the current zoom and rotation, in the Technique's geometry.
_Avoid_: grid component, exporter, preview renderer

**Drawing surface**:
What the Pattern renderer draws on inside the canvas panel: a base layer holding the cells, and an overlay layer holding everything that comes and goes with the pointer — hover preview, Selection, Mirror axes, paste preview and the Row progress marker. It is not the "canvas" of the App shell layout, which is the panel that holds it.
_Avoid_: canvas (that is the panel), bitmap, canvas element

## How to run it

[Add build/run instructions here as you develop.]

## Where to start

[Point new readers to the most important files or patterns in the codebase.]
