# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Patterns (hand weaving and loom weaving).

## Quick start

- **Issue tracker**: `.scratch/` (local markdown)
- **Architecture decisions**: `docs/adr/`
- **Agent skills config**: `docs/agents/`

## What is this app?

bd-beads lets a single user design beadwork Patterns for hand weaving (peyote, brick stitch) and loom weaving: set a Pattern's size in physical units, paint it using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product — see [ADR 0001](docs/adr/0001-local-only-persistence.md).

## Key concepts

- **Pattern**: a saveable, re-editable grid design (see Language below)
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md), amended by [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md) (dropped the color-to-bead mapping; a Pattern now has exactly one Bead)
- **Technique**: determines a Pattern's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Bead quantities**: the per-color bead counts a Pattern needs, counted straight from its painted colors — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md)
- **Pattern file**: the exported `.json` holding one Pattern or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **Convert image**: a second way to create a Pattern — from a picture rather than an empty grid, cropped to the Pattern's real-world size ([ADR 0010](docs/adr/0010-convert-image-fixed-physical-size.md)) with its colors saved as Image colors ([ADR 0011](docs/adr/0011-image-colors-stored-frozen.md))
- **App shell layout**: a top bar plus four panels (left main panel, above-canvas, canvas, below-canvas) that new UI must fit into; editing tools render above the canvas while a Pattern is open, New Pattern lives in the Saved Patterns box and zoom floats over the canvas panel's top-right corner (fixed to the panel, not to the Pattern's own sized box inside it), and the left main panel is used only for the New Pattern form — see [ADR 0004](docs/adr/0004-three-panel-app-shell.md) and [ADR 0005](docs/adr/0005-tools-above-canvas.md) before adding a new screen or control

## Language

**Pattern** (RU: Схема):
A saveable, re-editable beadwork design: a grid of cells (shape depends on the chosen technique and bead form factor), each cell painted with a color from the palette.
_Avoid_: design, drawing, chart

**Pattern library** (RU: Библиотека схем):
Every Pattern saved on this device, taken together — what the Saved Patterns box lists and what a library Pattern file exports in one go. It is a flat set with no ordering, grouping or nesting: a Pattern belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Pattern file. Saves itself as it changes, with no save action to take: every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in the top bar and keeps the change on screen rather than losing it silently. See [ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md).
_Avoid_: collection, gallery, saved list, workspace

**Palette** (RU: Палитра):
A free-standing set of colors used to paint pattern cells. Independent from the bead catalog — a cell's color is not required to correspond to a real bead.
_Avoid_: color scheme

**Bead** (RU: Бисеринка / Бисер):
A catalog entry for a specific real bead: brand, name, size, form factor, and color (e.g. Miyuki Delica 11/0), plus its physical footprint in mm (used to convert a Pattern's physical size into a grid — see ticket 01). The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: seed bead type, item

**Form factor** (RU: Форм-фактор):
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a pattern cell.
_Avoid_: bead shape

**Technique** (RU: Техника плетения):
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a pattern's cells. A pattern has exactly one technique and one bead catalog entry for its entire grid.
_Avoid_: stitch, weave type

**Row progress** (RU: Прогресс по рядам):
An overlay toggled on top of the pattern editor (not a separate mode) that tracks which rows have already been woven: a sequential "current row" pointer, movable backward, with finished rows shown dimmed, the current row distinctly highlighted, and remaining rows in normal colors. While it's on, finished rows are locked: no drawing command (Paint, erase, Fill, Paste, Mirror) changes them, though Undo still restores an earlier grid in full. Delete all is the exception: it clears Row progress along with the grid. A Replace Bead that changes grid dimensions resets it the same way. Saved together with the pattern.
_Avoid_: progress bar, completion state

**Row direction** (RU: Направление рядов):
Which way the weaver's rows run across a Pattern's grid for Row progress: along the grid's rows, or down its columns. Each direction keeps its own current-row pointer. Independent of rotating the Pattern, which only turns the picture on screen: after rotating, the weaver flips Row direction too, but neither ever changes the other.
_Avoid_: progress orientation, row rotation

**Mirror** (RU: Отражение):
A symmetric-drawing aid for a Pattern. Each direction (left–right and top–bottom) has its own count of Mirror axes, from 0 (off) up to one fewer than the cells across that direction. N axes split the grid into N+1 equal strips (an axis may run through the middle of a cell, which then mirrors onto itself); painting a cell with the Paint tool also paints its counterpart in every other strip. By default neighbouring strips are mirror images of each other (A | A′ | A); a copy mode, one switch for both directions, instead repeats the strip unflipped (A | A | A). Directions are as seen on screen, so rotating the Pattern swaps the two counts. Axes are drawn as faint lines on the canvas while either count is above 0. A separate "Mirror current" action per direction does a one-time sync of what's already painted, copying the strip with the most painted cells onto the rest (1 center axis if that direction's count is 0), honouring copy mode; hovering it shows the axes and dims the cells it would overwrite. Axis counts and copy mode are an editing-session setting, reset when switching Patterns or when a Replace Bead changes grid dimensions. Fill and Delete all are not affected by Mirror; Paste now is — see Paste.
_Avoid_: reflect, symmetry mode, apply mirror

**Toolbox** (RU: Панель инструментов):
The strip of editing controls above the canvas while a Pattern is open, made up of Tool groups. Stays pinned near the top of the viewport once scrolled to, so it stays reachable while working on the lower rows of a Pattern taller than the screen.
_Avoid_: tool strip, toolbar

**Tool group** (RU: Группа инструментов):
One titled box within the Toolbox gathering related controls — e.g. Tools (Paint, Fill, Select), Colors, Edit, Mirror, Row progress. Holds at most 14 controls in view (two rows of seven); a group with more shows that it has more and expands in place, downward, while the pointer is inside it.
_Avoid_: subbox, card, section, panel

**Delete all** (RU: Очистить всё):
Resets the open Pattern to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Pattern's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: clear, reset, wipe

**Replace Bead** (RU: Заменить бисер):
Swaps a Pattern's single Bead for a different catalog entry, after a confirmation that names what will change. Real-world size stays fixed, so the grid (columns × rows) recalculates from the new Bead's footprint; existing colors are rescaled onto the new grid (proportional resampling) rather than cropped, approximating the same design at the new resolution. Row progress and Mirror axis counts reset, since both are tied to a grid that no longer matches. One undo step restores the Pattern exactly as it was before the swap. Works whether or not the Pattern has been painted on.
_Avoid_: change bead, swap bead, resize pattern

**Custom color** (RU: Свой цвет):
A one-off paint color chosen freely with the color picker in the Colors group, outside the Palette. Not added to the Palette and not remembered: choosing another Custom color replaces it. Cells painted with it keep that color and show up in Bead quantities like any other color.
_Avoid_: user color, extra palette color

**Selection** (RU: Выделение):
A rectangular area of a Pattern's cells, marked out by dragging with the Select tool and left highlighted once the drag ends. Exactly one is active at a time: a new drag replaces the previous one, and leaving the Select tool, switching or creating a Pattern, making a Copy, or right-clicking the canvas or pressing Escape while nothing is copied clears it. It marks out cells, it does not change them — selecting never paints anything.
_Avoid_: region, highlighted area, selected block

**Copy** (RU: Копировать):
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists, and immediately clears the Selection highlight (the clipboard stays armed; copying the same block again requires reselecting it). The clipboard is an editing-session aid like the undo stack: never saved with the Pattern, and cleared on the same events (a Pattern switch, plus a new Selection or a new Copy replacing it, the user cancelling out of Paste, or the Select tool being left — nothing outlives the marquee it came from).
_Avoid_: duplicate, clone

**Paste** (RU: Вставить):
Stamps the copied block onto the grid with its top-left corner at the clicked cell, as one undo step, and can be repeated at as many positions as wanted until the clipboard is replaced or cleared. A stamp reaching past the grid's edge is clipped silently rather than blocked or shifted, and the block's empty cells are holes: they leave the destination's own color alone instead of erasing it, so a motif stamped onto painted background doesn't punch through it. While a block is on the clipboard, hovering previews the block at every Mirror strip it would land in (not just under the pointer), and clicking stamps all of those copies at once as a single undo step, honouring copy mode; each copy keeps Paste's own hole rule independently. While a block is on the clipboard a click means Paste, so right-clicking the canvas or pressing Escape cancels it: the block is dropped and clicking marks out Selections again.
_Avoid_: place, insert, apply

**Undo** (RU: Отменить):
Steps the grid back to how it was just before the most recent step-worthy edit — a whole dragged Paint/erase stroke, a Fill, a Paste, a Replace Bead, or a "Mirror current" — restoring it in full even where the edit has since been covered by Row progress's finished-row lock; Undo replays history rather than drawing, so the lock never blocks it. Rotate, Row direction, moving the Row progress pointer, Select, and Copy are not edits and are never undo steps. An editing-session aid like the clipboard: never saved with the Pattern, and reset whenever the open Pattern changes. Available anywhere in the editor via Ctrl/Cmd+Z, except while typing in a form field.
_Avoid_: revert, step back

**Redo** (RU: Повторить):
Steps forward through whatever Undo has stepped back from, re-applying each undone edit in order; Undo and Redo can be alternated freely without losing or duplicating a step. A new edit that actually changes the grid clears it — the same edits that count as an Undo step in the first place, so one that lands on nothing (e.g. aimed only at finished rows) leaves it alone. Reset alongside Undo whenever the open Pattern changes. Available anywhere in the editor via Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing in a form field.
_Avoid_: repeat, step forward

**Convert image** (RU: Конвертировать изображение):
Creating a Pattern from a picture instead of an empty grid: the picture is shown rendered as beads, and a frame — the Pattern itself, sized by its physical dimensions, Bead and Technique — is positioned over it to choose which part is kept. What falls inside the frame is resampled onto the Pattern's grid and its colors become the Pattern's Image colors. A way of creating a Pattern only, never a command that converts into one already open.
_Avoid_: import image, trace, pixelate, image import

**Image colors** (RU: Цвета изображения):
The set of colors one Convert image produced, saved with that Pattern and offered alongside the Palette while it is open. Frozen at the moment of conversion: painting a new color never adds to it and erasing one never removes it, because it records what the conversion found rather than what the Pattern currently holds. A Pattern created any other way has none.
_Avoid_: extracted palette, pattern palette, image palette, pattern colors

## How to run it

[Add build/run instructions here as you develop.]

## Where to start

[Point new readers to the most important files or patterns in the codebase.]
