# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Projects (hand weaving and loom weaving).

## Quick start

- **Issue tracker**: `.scratch/` (local markdown)
- **Architecture decisions**: `docs/adr/`
- **Agent skills config**: `docs/agents/`
- **Coding standards**: [CODING_STANDARDS.md](CODING_STANDARDS.md); testing in [docs/testing.md](docs/testing.md)

## What is this app?

bd-beads lets a single user design beadwork Projects for hand weaving (peyote, brick stitch) and loom weaving: set a Frame's size in beads (or mm/cm, converted once to beads), paint on the canvas using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product, today — see [ADR 0001](docs/adr/0001-local-only-persistence.md); [ADR 0014](docs/adr/0014-mvp-stays-local-only-hosted-phase-deferred.md) lays out the planned hosted phase and why it's deliberately not part of this release.

## Key concepts

- **Project**: everything saved under one name — an Open canvas of Pieces with a Frame on it (see Language below)
- **Pattern**: only the beads inside a Project's Frame, which is what Export, Beads needed, Row progress and Rotate act on
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md), amended by [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md) (dropped the color-to-bead mapping; a Project now has exactly one Bead)
- **Technique**: determines a Project's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Pattern size**: the Frame's columns × rows in beads; the mm shown is only an estimate, and Replace Bead keeps every bead — see [ADR 0026](docs/adr/0026-open-canvas-and-frame.md) and [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md). There is no limit on size beyond what the device can hold ([ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cell cap)
- **Bead quantities**: the per-color bead counts a Pattern needs, counted straight from its painted colors (with an Estimated weight beside them) — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md)
- **Project file**: the exported `.json` holding one Project or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **Convert image**: a second way to create a Project — from a picture rather than an empty grid, with the picture becoming the Pattern, cropped to the Pattern's real-world size ([ADR 0010](docs/adr/0010-convert-image-fixed-physical-size.md), amended by [ADR 0026](docs/adr/0026-open-canvas-and-frame.md)) with its colors saved as Image colors ([ADR 0011](docs/adr/0011-image-colors-stored-frozen.md))
- **Visual language**: how the app looks — light, dark and high contrast themes, tokens, layout, components, copy and artwork — is set by the design system in `docs/design/system/` (owned by the repo, baseline v18), entered through [DESIGN.md](DESIGN.md); see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), amended by [ADR 0030](docs/adr/0030-the-repo-owns-the-design-system.md). The App shell layout below is the redesigned one (ticket 141); the redesign tickets restyle its parts
- **App shell layout**: how the screen is arranged — at 1024px and wider a header, the left column (Toolbox, save box, Beads needed, Saved Projects) and the canvas box; under 1024px the phone layout, with the canvas on top and the Dock below it ([ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), [ADR 0032](docs/adr/0032-everything-under-1024px-is-the-phone-layout.md)). The full arrangement is in [docs/layout.md](docs/layout.md)
- **Text fit check**: the browser check, part of `npm run visual`, that no text or Tooltip is cut off or pokes out of its box in any language at any supported width; how it works and how to extend it is in [docs/testing.md](docs/testing.md#text-fit-check)

## Language

**Project**:
Everything saved under one name: the Open canvas with all its Pieces, the Frame, Technique, Bead, rotation, Row progress, Image colors and maker's name. What a person creates, opens, saves, lists in the library, exports as a file and shares. A Project with no Frame has no Pattern yet (ADR 0028, ticket 262).
_Avoid_: design, drawing, chart, pattern (for the whole saved thing)

**Pattern**:
The beads inside a Project's Frame: what the PNG and PDF exports contain, what Beads needed counts, and what Row progress and Rotate work on. Only the word for this; the code has no `Pattern` type, it reads the Frame's beads (`beadsInFrame`). The Overview and Tour say Pattern only for this, never for the whole canvas.
_Avoid_: for the whole saved canvas, which is a Project

**Open canvas**:
What a Project is drawn on: an endless field of bead positions with no board and no fixed size (see [ADR 0026](docs/adr/0026-open-canvas-and-frame.md)), laid out on the Technique's Grid. Positions are addressed by row and column, negative included, and only painted ones are stored. The person draws anywhere, and moves around with the Hand tool, the wheel, two fingers or Space + drag.
_Avoid_: board, infinite grid, sheet

**Grid**:
The endless arrangement of positions on the Open canvas set by the Technique: loom rows stack, peyote rows nest, brick stitch rows are offset by half a bead with a seam between them. It has no edge and no size; the Frame, not the Grid, gives a Pattern its size.
_Avoid_: board, for the beads themselves or for the Pattern

**Position marks**:
How the Grid's empty positions outside the Frame and its keep-out margin are drawn on the Open canvas, in the style chosen as a preference on the device from the Canvas color popover: **Dots** (a dot at each position, the default) or **Squares** (an outline in the gap round each position with its inside left clear, shaped like the Technique's bead). Inside the Frame an empty position is an empty bead instead; the keep-out margin has none. Never in exports.
_Avoid_: grid dots, background dots

**Piece**:
A set of beads that touch by a side or a corner. Pieces form, merge and split as beads are painted and erased. Each Piece belongs to exactly one Piece area.
_Avoid_: island, cluster, group, shape

**Piece area**:
The rectangle around one or more Pieces, with, while there is no Frame, its own rulers. Each Piece's area counts as everything within one bead outside its own bounds; Piece areas whose rectangles overlap, lie inside or touch once that margin is included join, repeated until none do, so Pieces with one empty bead between them share one rectangle and one set of rulers while two or more empty beads keep them apart, and a large Piece never shows smaller Pieces' rectangles inside or against its own. The margin only decides what joins; the drawn rectangle stays around the beads. A Piece area shows its rectangle and rulers only when its joined rectangle spans more than 4 beads in total (width times height, so a single row of 5 counts and 2x2 does not); smaller ones are not drawn, and beads, Pieces, Export and Beads needed are unchanged. Forms, merges and splits as beads are painted and erased. With no Frame, a whole row or column of one can be selected by its ruler number and removed with Remove row/column. The Rulers toggle shows or hides it; the Frame is never hidden by it.
_Avoid_: group, cluster, island

**Frame**:
The one rectangle per Open canvas, on whole beads, that marks which beads are the Pattern. A line, plus a **keep-out margin** (below): drawing outside it stays possible beyond the margin and is saved with the Project, but Export, Beads needed, Row progress and Rotate read only what is inside. With a Frame the Pattern has a size (the Pattern size) . Set, moved, resized and removed as Undo steps that never change a bead. A Project from before the Frame opens with a Frame the size of its old grid.
_Avoid_: border, crop, artboard, page, grid size

**Keep-out margin**:
The 3 bead positions all the way round a set Frame, outside its line (ADR 0027, ticket 261), drawn flat: a gap in the Position marks, with a dashed outline that shows only while the Frame is being set, moved or resized and for 1s after a press in it is refused; the pointer shows not-allowed there. Nothing can be drawn there: Paint, Fill, Paste, Mirror and Rotate all leave it empty (a stroke across it paints only the beads outside it, still one Undo step); Erase still works on anything. Setting, moving or resizing the Frame, and Rotate, move any Piece that reaches it clear, outward, with a Message that counts the Pieces moved and one Undo step. Removing the Frame removes the margin. Projects saved with beads in a margin open unchanged; those beads are dealt with the first time the Frame is edited. Export, Beads needed and Row progress count the Frame only, so they ignore it.

**Set Frame**:
The mode (6, or the Frame row in the Toolbox) in which dragging on the canvas draws the Frame, snapped to whole beads, with eight handles (four on touch) and a size tooltip. Also: Fit to drawing (wraps every bead; disabled while the canvas has no beads) and Remove Frame, and Width/Height steppers once set.
_Avoid_: crop, resize, set size

**Hand tool**:
The tool (5) that moves the view by dragging and never changes a bead. Space + drag does the same from any tool.
_Avoid_: pan mode, grab tool

**Pen mode** / **Mouse mode**:
The input mode: which pointer draws with the current Tool and which one moves the canvas. In Pen mode the pen draws, and a finger or mouse drags the canvas like the Hand tool, so a palm resting on an iPad does not paint. In Mouse mode (the default) a finger or mouse draws and the pen drags the canvas. Told apart by each event's pointer type, not by the Tool; two-finger pinch, the wheel and Space + drag work in both. One toggle picks it (after the Frame tool in the Toolbox, first in the phone Dock), offered only once a pen has been seen (the first pen event of a visit, kept on the device), and that first pen switches to Pen mode unless a mode was chosen before; the choice is kept on the device.
_Avoid_: stylus mode, touch mode, palm rejection

**Rulers toggle**:
The button (and R, and the phone's zoom pill) that shows or hides every ruler and size marking on the canvas, and the Piece areas' rectangles — each Piece area's, the Frame's and the Frame's size tooltip while it is set — kept as a preference on the device like the theme. Rulers show column numbers above and row numbers left of each Piece area, from 1, or the Frame's on all four sides once a Frame is set.
_Avoid_: ruler switch, numbers toggle

**Canvas zoom**:
The zoom the app's own controls and gestures change (zoom buttons, pinch and Ctrl/⌘ + wheel over the canvas, Ctrl/⌘ + plus, minus and 0), applied to the canvas alone. It is the only zoom there is: the header, the Toolbox, the Dock and every sheet keep their size ([ADR 0034](docs/adr/0034-only-the-canvas-zooms-page-zoom-is-locked.md)).
_Avoid_: scale, magnify, page zoom (a different thing)

**Page zoom**:
The browser's own whole-page zoom (pinch on the page, double-tap, Ctrl/⌘ + wheel outside the canvas, the browser's zoom menu). The app locks it so the chrome never changes size.
_Avoid_: UI scale, browser scale

**Zoom floor**:
The smallest zoom, 10%, the same on every screen: zoom out, pinch, wheel and Fit all stop there, so a Pattern wider or taller than the screen can be seen whole. Fit never goes above 100%.
_Avoid_: min zoom, bead-min floor

**Ruler step**:
How many beads apart the rulers show a number, chosen from 5, 10, 50, 100 and so on as the smallest that leaves every number clear at the current zoom; the beads between are drawn as Ruler dots. The Ruler step applies from 50% zoom up; below 50% a ruler shows only its last number (the column count along the columns, the row count along the rows, on every Frame side and every Piece ruler), and the beads without a number keep their dots.
_Avoid_: label interval, tick spacing

**Ruler dot**:
The small mark a ruler draws for a bead that has no number at the current Ruler step; every 5th is a bolder dot, and a dot, like a number, selects its whole row or column when clicked. At a bead pitch too small for a dot per bead, only the 5th-bead dots remain.
_Avoid_: tick, marker

**Ruler layout**:
Everything the rulers are for one view of the open canvas, worked out once from the Project and the Surface view: the boxes that carry rulers, the numbers and Ruler dots to draw, and what a point of the viewport selects. The overlay draws it and a press asks it, so what is drawn and what is picked cannot disagree; the Ruler step is chosen once per axis per box inside it. The print rulers (fixed step, no dots, no picking) are not part of it.
_Avoid_: ruler view, ruler geometry

**Canvas color**:
The background of the drawing area, picked by the person from the Canvas color button in the canvas strip: five in light, six in dark, stored as a number so a change of theme keeps the position. A preference on the device like the theme: not saved with a Project and not in exports, which always print on the light board. The same popover holds the Position marks toggle (Dots | Squares). High contrast has one white canvas, so its button opens the toggle alone, with no swatches.
_Avoid_: board color, background theme

**Project library**:
Every Project saved on this device, taken together — what the Saved Projects box lists and what a library Project file exports in one go. It is ordered by last save, most recently saved first, with no grouping or nesting: saving a Project (any change to it, or Save) moves it to the front, a new or imported Project starts there, and a library saved before the order existed is put in order by when each Project was last changed (ticket 145). A Project belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Project file. Saves itself as it changes, so the Toolbox's Save only reassures on the device side: it writes at once and says "Saved", or says so if the device refuses (ticket 115). Save also hands over the open Project as a Project file, so a Project can be opened on another device without a separate Export (ticket 119). Every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in the top bar and keeps the change on screen rather than losing it silently. Importing while a Project is open asks first whether to switch to the imported Project (saying the current one's progress is saved, or, after a failed save, offering to save it first); either way the imported Project joins the library, and with no Project open it opens without asking (ticket 154). The Saved Projects box asks too: the remove × asks "Remove this Project?" in a danger confirmation, and picking a different thumbnail asks "Switch Project?" naming both, with the same save-first offer after a failed save; picking the open Project does nothing (ticket 232). See [ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md).
_Avoid_: collection, gallery, saved list, workspace

**Maker's name**:
Who made the Projects on this device: an optional name, at most 40 characters, printed on every PDF and PNG export. It belongs to the person, not to a Project, so it is kept on the device like the theme and never sent anywhere (ADR 0001); it is set from the Export menu's last row, "Name on exports", and the exports leave it out while it is empty (ticket 161). A Project can override it with its own maker's name, set from the New Project form and blank by default regardless of the device-wide value; set, it replaces the device-wide name on that Project's exports and background watermark, alongside the Project's own name, and it travels with the Project (export, import, another device) rather than staying behind on this one (ticket 182).
_Avoid_: author, owner, signature, user name

**Palette**:
A free-standing set of colors used to paint project cells: twelve built-in colors, followed by the Custom colors that have joined it (up to 28, so at most 40 swatches), in the order they were first used. An added swatch can be removed again (never a built-in one): an added swatch shows a × while it is the active color and while a mouse or an Apple Pencil hovers it or keyboard focus is on it (and Delete or Backspace works on a focused one), which asks for confirmation first; painted cells keep their color, and an Undo toast puts it back. Independent from the bead catalog — a cell's color is not required to correspond to a real bead. The added colors are kept on the device, not in a Project; only the built-in ones have keyboard shortcuts. See [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md).
_Avoid_: color scheme, fixed palette

**Bead**:
A catalog entry for a real bead line: brand, name, size and form factor (e.g. Miyuki Delica 11/0), not a color (that is a Bead color), plus its physical footprint in mm (used to convert an mm/cm size into a grid when a Project is created, and to work out an Estimated size — see ticket 01). Width runs along the thread (the bead's length through its hole) and height across it (its diameter), so TOHO Round 11/0 is 1.5 × 2.2mm, not a 2.2mm ball. A Bead may carry a per-bead width correction (mm added to each column for thread and slack, measured rather than published — currently 0.15mm on TOHO Round 11/0), so a column is `widthMm + widthCorrectionMm` wide. The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: seed bead type, item

**Bead color**:
One real color of a Bead line, with its maker's code (e.g. TOHO Round 11/0 #25). Decided, not built yet: see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: bead shade, catalog color

**Color catalog**:
Every Bead color of every Bead line, offered for building a Palette; inside a Project it offers the colors of that Project's Bead, so what Beads needed lists can be bought. Open to everyone, a Guest included. Decided, not built yet: see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md).
_Avoid_: color library, swatch catalog

**Form factor**:
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a project cell.
_Avoid_: bead shape

**Technique**:
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a project's cells. A project has exactly one technique and one bead catalog entry for its entire grid. It is chosen when the Project is created and can be changed on an open Project from the Frame menu (ticket 351): only the geometry changes (row shift and row pitch), so the Pattern keeps its columns, rows, Bead and Frame and every cell keeps its row and column (a picture drawn for one technique will look different in another). A Frame that began on an odd row takes in the row above when the new technique is peyote or brick stitch, which start on an even row. One undo step; waits while Row progress is on.
_Avoid_: stitch, weave type

**Row progress**: With an Open canvas it works on the Frame's rows only (the finished-row lock covers the Frame only); with no Frame it cannot be turned on: its switch is disabled, its Tooltip says "Set a Frame first.", and the Progress bar offers Set Frame.
An overlay toggled on top of the project editor (not a separate mode) that tracks which rows have already been woven: a sequential "current row" pointer, movable backward, with finished rows shown slightly dimmed (never grey) and restored to normal color while the pointer hovers a finished row or after a tap on a finished row (a view setting, not saved and not an Undo step), the beads of the current row drawn 10% brighter, lifted above their neighbours and each ringed in the marker color, and remaining rows in normal colors (tickets 352, 376). While it's on, finished rows are locked: no drawing command (Paint, erase, Fill, Paste, Mirror) changes them, though Undo still restores an earlier grid in full. Clear project is the exception: it clears Row progress along with the grid. The Frame cannot be changed, and Rotate and the Technique wait, while it is on. Saved together with the project. Every control for it — the switch that turns it on (the Zoom pill's Row progress button is the same action, `P`), Row direction, the pointer readout and the buttons that move the pointer — lives in the Progress bar along the canvas box's bottom edge (ticket 144).
_Avoid_: progress bar (as a name for this overlay/mechanic — it isn't a fill/percentage visualization, which is exactly what "Progress bar" is reserved for instead, see Progress bar), completion state

**Pass** (ticket 347): what Row progress's pointer counts. A line is a row or a column of the Frame, whichever way the weaver's rows run. On loom and brick stitch a pass is one whole line. On peyote the first line is one pass, and every later line takes two, each adding every other bead of it: the beads at even positions along the line first (the larger half on an odd line), then the odd ones. A 7-bead line is woven as 7, 4, 3, 4, 3, ... beads; an 8-bead line as 8, 4, 4, 4, .... The current-row marker is a ring round each bead the pass weaves, and only those (ticket 376), finished passes dim and lock only their own beads, and the Progress bar and rulers count passes and lines accordingly. A peyote Project saved before this keeps its pointer number, which now counts passes.
_Avoid_: half-row, sub-row (a pass is the word; "row" and "line" keep meaning the whole row or column)

**Row direction**:
Which way the weaver's rows run across a Project's grid for Row progress: along the grid's rows, or down its columns. Each direction keeps its own current-row pointer. Independent of rotating the Project, which only turns the picture on screen: after rotating, the weaver flips Row direction too, but neither ever changes the other.
_Avoid_: progress orientation, row rotation

**Progress bar**:
The bar along the canvas box's bottom edge that holds every Row progress control (ticket 144): a Show row progress switch, the "Row 12 · of 30 · top to bottom" readout, a track filled with the finished share, Turn row direction, Row not done (moves the pointer back one) and Row done (marks the row finished and moves on). From 1024px up it is always there while a Project is open, whatever its shape, because its switch is how Row progress is turned on; while Row progress is off only the switch and its label show, and the bar keeps its height. Under 1024px it shows exactly while Row progress is on, and the Zoom pill's Row progress button is the switch. The switch's key is `P`. Separate from the Row progress marker drawn on the grid (the current-row outline).
_Avoid_: progress control, row control

**Mirror**:
A symmetric-drawing aid for a Project. Each direction (left–right and top–bottom) has its own count of Mirror axes, from 0 (off) up to one fewer than the cells across that direction. N axes split the grid into N+1 equal strips (an axis may run through the middle of a cell, which then mirrors onto itself); painting a cell with the Paint tool also paints its counterpart in every other strip. By default neighbouring strips are mirror images of each other (A | A′ | A); a copy mode, one switch for both directions, instead repeats the strip unflipped (A | A | A). Directions are as seen on screen, so rotating the Project swaps the two counts. Axes are drawn as faint lines on the canvas while either count is above 0. A separate "Mirror current" action per direction does a one-time sync of what's already painted, copying the strip with the most painted cells onto the rest (1 center axis if that direction's count is 0), honouring copy mode; hovering it shows the axes and dims the cells it would overwrite. Axis counts and copy mode are an editing-session setting, reset when switching Projects or when the Frame changes. Fill and Clear project are not affected by Mirror; Paste now is — see Paste.
_Avoid_: reflect, symmetry mode, apply mirror

**Toolbox**:
The fixed-width rail of editing controls down the left of the app shell while a Project is open (no wider than 200px, thinner on a tablet), made up of Tool groups stacked vertically. Takes the left column in turn with the New Project form. Stays pinned near the top of the viewport while the canvas is in view, so it stays reachable while working on the lower rows of a Project taller than the screen, and un-pins once the canvas has scrolled past.
_Avoid_: tool strip, toolbar, above-canvas panel

**Tool group**:
One titled box within the Toolbox gathering related controls — e.g. Tools (Paint, Fill, Select, Eraser), Colors, Edit (including Save and PNG and PDF export), Mirror, Size. Lays its controls out four to a row (three on a tablet) and holds at most 16 in view (four rows of four); a group with more shows that it has more and expands in place, downward, while the pointer is inside it.
_Avoid_: subbox, card, section, panel

**Dock**:
The bottom bar at every width under 1024px (phones and iPads alike, portrait and landscape; ADR 0032), with no header above the canvas. Five slots, each opening its own sheet: Tool, Colour, Frame (which also holds Rotate, Copy and Paste), Project, Menu. icon-only with no labels, 48px tall plus the safe-area inset; at most about 480px wide, centred. With no Project open, a New Project / Import bar takes its place, with the Menu button still at the bottom right.
_Avoid_: toolbar, rail, tab bar

**Menu**:
The Dock's last slot: a modal sheet of app-wide settings and links (language, theme, Name on exports, Keyboard shortcuts, Overview, the source link). Everything about the open Project lives in the Project sheet instead.
_Avoid_: More, header menu

**Zoom pill**:
The movable pill floating over the canvas under 1024px: Rulers, Undo, Redo, the Row progress button, zoom out, the zoom level, zoom in, Fit. Dragging it from anywhere on it (past about 6px; a tap still presses the button) moves it anywhere inside the canvas box, and it stays exactly where it is dropped, with no snapping; Alt + an arrow key nudges it a step. It is always fully visible: when the canvas box shrinks or the screen turns it is pulled back inside, and it keeps its relative place when the box grows again. The position is kept on the device. Its Row progress button is the same action as the Progress bar's switch (`P`), not a separate show/hide: turning it on turns Row progress on and shows the Progress bar, turning it off turns Row progress off and hides the bar. The bar cannot be hidden while Row progress stays on.

**Tool button**:
A Tools-group tool shown as an icon-only tab (Paint is a pencil), 56px wide, five to a row, selected by an accent underline, with no text label: its name, its shortcut and, where the tool needs one, a one-line description appear in its Tooltip. Every tool has a digit key, 1 to 6 in the order Paint, Fill, Select, Eraser, Hand, Frame (7 to `=` are left free for later tools; ticket 292), shown as a small badge beside the icon on every device. The letters E, H and F no longer pick tools. The name stays as the button's accessible name.
_Avoid_: tab, tool tab

**Tooltip**:
The design system's hover, keyboard-focus and long-press (on touch) help for a control: a name (always), the shortcut as a key chip (optional) and a description line (optional). Any control may have one, icon-only or labelled: a control shows a Tooltip exactly when one is given to it, with no other condition. It replaces the browser's native title everywhere. A disabled control's Tooltip says why it is disabled. It is not an (i) button that has to be clicked; always-visible help text is a Note. A Tooltip is never clipped (ticket 265): its bubble opens in the browser's top layer, outside every column, sheet and canvas that holds its button, on the side of the button that has room (above near the bottom of the screen, below near the top), inside the screen on all four edges, and wraps at a maximum width (the wide-tooltip measure, 15rem) instead of running in one long strip.

**Note**:
A thin, always-visible gray block of helper text under a control or panel (for example the Estimated size or the Bead quantities explanation). It replaces every (i) button that had to be clicked to show its text.
_Avoid_: info tip, (i) popup, hint

**Eraser**:
The 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: its primary press/tap erases a single bead under the pointer, dragging to erase a line, the same way right-click erase already worked (ticket 176 — renamed from "Erase" and switched from its original flood-erase primary behavior, so it works on touch/phone without needing a right-click). Behaves like every other drawing command — one undo step per stroke, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Right-click erase is still available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill) for erasing without switching tools; under Eraser itself, right-click is now redundant with the primary press. Its key is `4` (ticket 292; it was `E` from ticket 250). `Del` never picks the Eraser: it only empties the beads of the Selection.
_Avoid_: erase mode, clear tool

**Clear**:
Resets the open Project to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Project's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: delete all, reset, wipe

**Pattern size**:
How big a Pattern is: its Frame's width × height, counted in beads (a Project with no Frame has no Pattern size yet). It is set in the Frame section, in beads or mm (the unit is remembered on the device, not in the Project); a size in mm always rounds up to the next whole bead and is not remembered. A stepper press adds or removes one bead in either unit. Not limited in size beyond what the device can hold (see [ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cap ADR 0026 set).
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
Swaps a Project's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Pattern size and every painted cell stay as they are, whichever unit the Project was created in — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A paint color chosen freely with the color picker in the Colors group. The first time it paints a cell it joins the Palette as a new swatch (unless its hex is already a swatch, or 28 have been added), and from then on it is an ordinary Palette swatch. Until it is used it is only the picker's current color, and choosing another replaces it. Cells keep the hex, so a Project opens with its colors on a device that lacks the swatch.
_Avoid_: user color, extra palette color, one-off color

**Selection**:
A rectangular area of a Project's cells, marked out by dragging with the Select tool, or by clicking a number on the row or column ruler (which marks out that whole row/column and makes Select the active tool, so selecting a line is Select's job too), and left highlighted once made. Choosing Paint, Fill or Hand drops it; Del, or choosing the Eraser, empties every bead in it as one undo step. Exactly one is active at a time: a new drag or ruler click replaces the previous one, and leaving the Select tool, switching or creating a Project, making a Copy, or right-clicking the canvas or pressing Escape while nothing is copied clears it (an Escape with no Selection, paste preview or open disclosure left to dismiss switches to the Paint tool instead). It marks out cells, it does not change them — selecting never paints anything.
_Avoid_: region, highlighted area, selected block

**Copy**:
Snapshots the Selection's cells — the empty ones included — into an in-session clipboard, available only while a Selection exists, and immediately clears the Selection highlight (the clipboard stays armed; copying the same block again requires reselecting it). The clipboard is an editing-session aid like the undo stack, never saved with the Project, but its own lifecycle is deliberately looser (see [ADR 0016](docs/adr/0016-clipboard-survives-pattern-and-tool-switches.md)): it clears only when a new Copy replaces it or a new Selection is made, and survives a Project switch, a tool switch, and cancelling out of Paste — none of which touch it anymore.
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

**Convert image**: Needs a size: the picture lands in a Frame of that size on a new Open canvas (ADR 0026).
Creating a Project from a picture instead of an empty grid: the picture is shown rendered as beads, and a frame — the Pattern itself, sized by its physical dimensions, Bead and Technique — is positioned over it to choose which part is kept. What falls inside the frame is resampled onto the Project's grid and its colors become the Project's Image colors. A way of creating a Project only, never a command that converts into one already open.
_Avoid_: import image, trace, pixelate, image import

**Image colors**:
The set of colors one Convert image produced, saved with that Project and offered alongside the Palette while it is open. Frozen at the moment of conversion: painting a new color never adds to it and erasing one never removes it, because it records what the conversion found rather than what the Project currently holds. A Project created any other way has none.
_Avoid_: extracted palette, pattern palette, image palette, pattern colors

**Project renderer**:
The one thing that draws a Project's cells — for the editor, the Convert image preview and the exports — so a bead looks the same wherever it appears. Draws whatever part of the Project is in view, at the current zoom and rotation, in the Technique's geometry. One renderer over two spaces: the open canvas of the editor, where every position is real and the Frame sits where it is, and the Frame alone of the exports, the Convert image preview and the Overview, where the Frame's first bead is position (0, 0). The overlay layer is drawn in the same space.
_Avoid_: grid component, exporter, preview renderer

**Drawing surface**:
What the Project renderer draws on inside the canvas panel: a base layer holding the cells, and an overlay layer holding everything that comes and goes with the pointer — hover preview, the bead pointer, Selection, Mirror axes, paste preview and the Row progress marker. It is not the "canvas" of the App shell layout, which is the panel that holds it.
_Avoid_: canvas (that is the panel), bitmap, canvas element

**Bead pointer** (ticket 353):
What the pointer is over the beads of an open Project, for a mouse and a hovering pen alike: a small bead-shaped marker, 90% of a bead as drawn (so it follows zoom), centred on the pointer rather than snapped to the bead under it, rounded in peyote and square otherwise, and looking like the hover preview (the chosen color at 60%, else the 2px dark outline). The OS pointer is hidden there; a pen lifting away or leaving the board drops it, and a finger shows none. The other pointers stay: not-allowed over the Frame's margin, grab for the Hand tool and Space, and the Set Frame cursor.
_Avoid_: crosshair, cursor (that is the keyboard's bead cursor)

**View link**:
A hosted, encrypted snapshot of a Project that a Guest or any account can create. The key is in the part of the link after `#`, so the backend never sees the Project; opening it shows the Project and can import it. Later edits don't change it and it can't be used to edit. It expires 3 days after it was last opened, and every open restarts the clock; an expired link is gone, and the Project has to be shared again, as a new link.
_Avoid_: share link, public link

**Guest**:
Someone using the app without signing in. Everything that works on the device works for a Guest, with no limit on Projects or their size; only what needs the backend is offered by account.
_Avoid_: anonymous user, visitor

**Free account**:
A signed-in person with no paid plan. Gets what needs little of the backend: the basic settings kept in step across their devices, and one synced Project. The exact set is decided by plan, not fixed here.
_Avoid_: basic plan, member

**Pro**:
The paid plan, for someone who would rather not manage their work on each device: what needs more of the backend, such as many synced Projects and Palettes saved to the account. Never needed for anything that works on the device; every feature that runs on the device is there for a Guest too.
_Avoid_: premium, subscriber, paid user

**Edit link**:
For a synced Project (a Free account's one, or a Pro's), the link whose `#` part is the Project's key; opening it on a device gives that device the same editable Project. Whoever holds it can read and edit the Project.
_Avoid_: sync link, invite link

**Locked Project**:
A synced Project listed on a signed-in device that doesn't yet hold its key; it opens only after the Edit link is opened there.
_Avoid_: encrypted Project, hidden Project

**Surface view**:
How a bead and a point on screen map onto each other, in both directions: where a bead or a block of beads is drawn, which bead is under a point, where to scroll to centre or fit a block, and how far one step along a row and one down are. Built from a Space, the Technique, the rotation, the zoom and the scroll, and the one place that knows about turning, the row shift and the row pitch. It measures the drawing, not the piece: brick stitch's 1px seam between rows exists only in the drawing, so a Surface view's rows are a pixel further apart than the physical geometry Convert image samples with (ADR 0010, amended).
_Avoid_: hit test, canvas view, grid geometry

**Overview**:
The page outside the editor, at its own address, that introduces bd-beads feature by feature to someone new to it. There are no accounts, so "new" means only that this device's Project library is empty.
_Avoid_: landing page, home page, about page, marketing page

**Tour**:
A skippable walk through the real editor that takes a new user from nothing to their first Project, one step at a time: each step points at one control, says what it does and asks the user to use it, and moves on once they have. The Project it builds is a real one in the Project library, not a practice copy.
_Avoid_: onboarding, tutorial, walkthrough, guide, coach marks

## How to run it

`npm install`, then `npm run dev` (Vite) and open the URL it prints; `npm run build` makes `dist/`. Every check (`npm test`, `npm run typecheck`, `npm run lint`, `npm run visual`, `npm run perf`) is in the README's [Checks](README.md#checks). While working, run only the tests related to your change (`npx vitest related --run <files>`), never the full suite by hand; CI runs it on every pull request. How tests are written: [docs/testing.md](docs/testing.md); what a change must follow: [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Where to start

`src/`, by layer ([ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md), feature folders inside the layers):

| Folder | What is there | Start with |
|---|---|---|
| `domain/` | Pure logic and data: Project, Frame, Pieces, Techniques, Row progress, Mirror, Selection, history, encodings and file formats | `project.ts`, `changeFrame.ts`, `projectFile.ts` |
| `rendering/` | Drawing on a canvas, shared by the editor, previews and exports: the Project, overlays, rulers, print pages | `projectRenderer.ts`, `overlayRenderer.ts` |
| `services/` | The only code that reaches outside the page: the Project library in localStorage, preferences, image decoding, file download | `index.ts`, `libraryStore.ts` |
| `composables/<feature>/` | The app's behavior, one composable per concern; user flows are `use<Name>Flow` | `shell/useAppShell.ts` (wires them all), `project/useEdit.ts`, `shell/controlRegistry.ts` |
| `components/<feature>/` | The Vue components for each feature: `canvas`, `tools`, `palette`, `export`, `import`, `project`, `shell`, `tour` | `shell/AppShell.vue` |
| `components/ui/`, `composables/ui/` | Primitives every feature builds on: `IconButton`, `AppButton`, `MenuButton`, `AppSwatch`, `AppNote`, `AppTooltip`, modals, menus, form fields; generic composables | `controlAction.ts` |
| `i18n/` | One typed dictionary per language (English, Russian, Chinese, Spanish, Polish), plurals, the language switch | `translations.ts`, `en.ts`, `ru.ts`, `zh.ts`, `es.ts`, `pl.ts` |
| `theme/` | Light, dark and high contrast, following the device | `theme.ts` |
| `styles/` | Tokens and shared CSS, from the design system | `tokens.css`, `design-values.css` |
| `overview/` | The Overview page a new visitor lands on (its own entry, `overview/index.html`) | `OverviewPage.vue`, `overviewRoute.ts` |
| `testUtils/` | Shared test helpers ([docs/testing.md](docs/testing.md)) | `seedProject.ts`, `editHarness.ts` |

Entry files: `src/main.ts` (picks the Overview or the editor, mounts `App.vue`), `src/App.vue` (pure composition, [ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md)), `src/features.ts` (switched-off features). Browser checks live in `e2e/`. Where things sit on screen: [docs/layout.md](docs/layout.md).
