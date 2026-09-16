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
- **Palette** and **Bead catalog**: kept as separate concepts, linked by a default color-to-bead mapping — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md)
- **Technique**: determines a Pattern's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Bead quantities**: the per-color bead counts a Pattern needs, resolved through the color-to-bead mapping in [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md)
- **Pattern file**: the exported `.json` holding one Pattern or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **App shell layout**: a top bar plus four panels (left main panel, above-canvas, canvas, below-canvas) that new UI must fit into; editing tools render above the canvas while a Pattern is open, and the left main panel is used only for the New Pattern form — see [ADR 0004](docs/adr/0004-three-panel-app-shell.md) and [ADR 0005](docs/adr/0005-tools-above-canvas.md) before adding a new screen or control

## Language

**Pattern** (RU: Схема):
A saveable, re-editable beadwork design: a grid of cells (shape depends on the chosen technique and bead form factor), each cell painted with a color from the palette.
_Avoid_: design, drawing, chart

**Palette** (RU: Палитра):
A free-standing set of colors used to paint pattern cells. Independent from the bead catalog — a cell's color is not required to correspond to a real bead.
_Avoid_: color scheme

**Bead** (RU: Бисеринка / Бисер):
A catalog entry for a specific real bead: brand, name, size, form factor, and color (e.g. Miyuki Delica 11/0), plus its physical footprint in mm (used to convert a Pattern's physical size into a grid — see ticket 01). The bead catalog ships pre-seeded with common lines (Miyuki, Toho) and the user can add more.
_Avoid_: seed bead type, item

**Form factor** (RU: Форм-фактор):
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a pattern cell.
_Avoid_: bead shape

**Technique** (RU: Техника плетения):
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a pattern's cells. A pattern has exactly one technique and one bead catalog entry for its entire grid.
_Avoid_: stitch, weave type

**Row progress** (RU: Прогресс по рядам):
An overlay toggled on top of the pattern editor (not a separate mode) that tracks which rows have already been woven: a sequential "current row" pointer, movable backward, with finished rows shown dimmed, the current row distinctly highlighted, and remaining rows in normal colors. While it's on, finished rows are locked: no drawing command (Paint, erase, Fill, Paste, Mirror) changes them, though Undo still restores an earlier grid in full. Saved together with the pattern.
_Avoid_: progress bar, completion state

**Row direction** (RU: Направление рядов):
Which way the weaver's rows run across a Pattern's grid for Row progress: along the grid's rows, or down its columns. Each direction keeps its own current-row pointer. Independent of rotating the Pattern, which only turns the picture on screen: after rotating, the weaver flips Row direction too, but neither ever changes the other.
_Avoid_: progress orientation, row rotation

**Mirror** (RU: Отражение):
A symmetric-drawing aid for a Pattern: with a horizontal and/or vertical toggle on, painting a cell with the Paint tool also paints its counterpart(s) reflected across the grid's exact center — 2 cells with one axis on, 4 with both. A separate "Mirror current" action per axis does a one-time reflect of whatever's already painted, for content drawn before that axis was toggled on. Fill is not affected by Mirror.
_Avoid_: reflect, symmetry mode, apply mirror

**Selection** (RU: Выделение):
A rectangular area of a Pattern's cells, marked out by dragging with the Select tool and left highlighted once the drag ends. Exactly one is active at a time: a new drag replaces the previous one, and leaving the Select tool, switching or creating a Pattern, or right-clicking the canvas or pressing Escape while nothing is copied clears it. It marks out cells, it does not change them — selecting never paints anything.
_Avoid_: region, highlighted area, selected block

**Copy** (RU: Копировать):
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists. The clipboard is an editing-session aid like the undo stack: never saved with the Pattern, and cleared on the same events (a Pattern switch, plus a new Selection or a new Copy replacing it, the user cancelling out of Paste, or the Select tool being left — nothing outlives the marquee it came from).
_Avoid_: duplicate, clone

**Paste** (RU: Вставить):
Stamps the copied block onto the grid with its top-left corner at the clicked cell, as one undo step, and can be repeated at as many positions as wanted until the clipboard is replaced or cleared. A stamp reaching past the grid's edge is clipped silently rather than blocked or shifted, and the block's empty cells are holes: they leave the destination's own color alone instead of erasing it, so a motif stamped onto painted background doesn't punch through it. Like Fill, Paste is unaffected by Mirror — it puts the block exactly where it was aimed. While a block is on the clipboard a click means Paste, so right-clicking the canvas or pressing Escape cancels it: the block is dropped and clicking marks out Selections again. The Selection survives that, so Copy can pick the same block straight back up; a second right-click or Escape clears the Selection too.
_Avoid_: place, insert, apply

## How to run it

[Add build/run instructions here as you develop.]

## Where to start

[Point new readers to the most important files or patterns in the codebase.]
