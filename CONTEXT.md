# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Projects (hand weaving and loom weaving).

## Quick start

- **Issue tracker**: `.scratch/` (local markdown)
- **Architecture decisions**: `docs/adr/`
- **Agent skills config**: `docs/agents/`

## What is this app?

bd-beads lets a single user design beadwork Projects for hand weaving (peyote, brick stitch) and loom weaving: set a Frame's size in beads (or mm/cm, converted once to beads), paint on the canvas using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product, today — see [ADR 0001](docs/adr/0001-local-only-persistence.md); [ADR 0014](docs/adr/0014-mvp-stays-local-only-hosted-phase-deferred.md) lays out the planned hosted phase and why it's deliberately not part of this release.

## Key concepts

- **Project**: everything saved under one name — an Open canvas of Pieces with a Frame on it (see Language below)
- **Pattern**: only the beads inside a Project's Frame, which is what Export, Beads needed, Row progress and Rotate act on
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md), amended by [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md) (dropped the color-to-bead mapping; a Project now has exactly one Bead)
- **Technique**: determines a Project's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Pattern size**: the Frame's columns × rows in beads; the mm shown is only an estimate, and Replace Bead keeps the grid — see [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), which supersedes [ADR 0008](docs/adr/0008-replace-bead-recalculates-grid.md). There is no limit on size beyond what the device can hold ([ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cell cap)
- **Bead quantities**: the per-color bead counts a Pattern needs, counted straight from its painted colors (with an Estimated weight beside them) — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md)
- **Project file**: the exported `.json` holding one Project or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **Convert image**: a second way to create a Project — from a picture rather than an empty grid, with the picture becoming the Pattern, cropped to the Pattern's real-world size ([ADR 0010](docs/adr/0010-convert-image-fixed-physical-size.md), amended by [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md)) with its colors saved as Image colors ([ADR 0011](docs/adr/0011-image-colors-stored-frozen.md))
- **Visual language**: how the app looks — light, dark and high contrast themes, tokens, layout, components, copy and artwork — is set by the design system in `docs/design/system/` (owned by the repo, baseline v18), entered through [DESIGN.md](DESIGN.md); see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), amended by [ADR 0030](docs/adr/0030-the-repo-owns-the-design-system.md). The App shell layout below is the redesigned one (ticket 141); the redesign tickets restyle its parts
- **App shell layout** (the canvas box holds an Open canvas with a canvas strip, the Hand/Set Frame tools, a Rulers toggle and the canvas hint; ADR 0026): a header, a notice row under it (only while there is something library-wide to say), then one left column that scrolls on its own beside the canvas box, which takes all the remaining width and height; the page itself never scrolls, and the Project scrolls inside the canvas box. The left column holds separate boxes in a fixed order: the Toolbox (or the New Project form in its place, with no Project open or during Convert image framing), the save box, Beads needed, Saved Projects. The header's summary holds the open Project's info alongside New Project and the Import controls; zoom sits at the canvas box's top-right; the Progress bar runs along the canvas box's bottom edge — see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), which supersedes the layout parts of [ADR 0004](docs/adr/0004-three-panel-app-shell.md) and [ADR 0005](docs/adr/0005-tools-above-canvas.md), before adding a new screen or control
- **Text fit check**: `e2e/visual/textFit.spec.ts` (part of `npm run visual`, ticket 229) opens the app in every language at every supported width, visits each screen, menu, sheet, dialog and popover, and measures — no reference screenshots — whether any text pokes out of its box, the screen or a clipping ancestor, is cut off by an ellipsis, or wraps in a control meant to be one line (`e2e/support/textFit.ts`; user-typed Project names, the closed drawer, carousel cards not yet scrolled to and the canvas's own backdrop and rulers are skipped). A failure names the screen, element, text, overflow in pixels, language and width. Places known to overflow are listed in `e2e/support/textFitPending.ts`, each deleted by the ticket that fixes it; an entry that stops overflowing fails the check until it is removed. To add a screen, add a `Screen` to `SCREENS` in the spec (its `visit` drives the app by its own controls and calls `measure()`, or returns false where the state can't be reached); to add a language, list it in `LOCALES` (the type check reminds you). `TEXTFIT_DEBUG=1` prints every misfit and skipped screen. **It also covers hover text** (ticket 264): on every screen it visits it finds every Tooltip trigger from the page (`.app-tooltip`, no list of triggers), opens each by mouse hover, keyboard focus and a touch long press, and measures the bubble against the screen, every ancestor that clips it and its own box (`e2e/support/hoverText.ts`); a failure names the screen, trigger, Tooltip text, pixels cut, language and width. Cut-off Tooltips known today are in `e2e/support/hoverPending.ts` (deleted by ticket 265, an entry that stops failing fails the check). Three guards keep it exhaustive: (1) discovery, above; (2) *reachability* — every component whose template makes a Tooltip (`<AppTooltip>`, `IconButton`, `ToolButton`; the bubble's `data-owner` says which) or an info popover must be seen open somewhere in the run, checked once by the Playwright global teardown after all language-and-width tests (`e2e/support/hoverReach.ts`), so a Tooltip in a state no screen visits fails naming the component: add a `Screen` that reaches it, or list it in `UNREACHED` with a reason (`e2e/support/hoverExemptions.ts`); (3) *one way to make hover text* — `e2e/visual/hoverSource.spec.ts` reads the templates and fails on a native `title` or a hand-made tooltip that is not listed (`NATIVE_TITLES`, each "native, cannot be clipped" until moved onto the Tooltip; `INFO_POPOVERS`, which text fit measures once). A partial run (one language or width) skips guard 2.

## Language

**Project**:
Everything saved under one name: the Open canvas with all its Pieces, the Frame, Technique, Bead, rotation, Row progress, Image colors and maker's name. What a person creates, opens, saves, lists in the library, exports as a file and shares. A Project with no Frame has no Pattern yet (ADR 0028, ticket 262).
_Avoid_: design, drawing, chart, pattern (for the whole saved thing)

**Pattern**:
The beads inside a Project's Frame: what the PNG, PDF and QR exports contain, what Beads needed counts, and what Row progress and Rotate work on. Only the word for this; the code has no `Pattern` type, it reads the Frame's beads (`beadsInFrame`). The Overview and Tour say Pattern only for this, never for the whole canvas.
_Avoid_: for the whole saved canvas, which is a Project

**Open canvas**:
What a Project is drawn on: an endless field of bead positions with no board and no fixed size (see [ADR 0026](docs/adr/0026-open-canvas-and-frame.md)). Positions are addressed by row and column, negative included, and only painted ones are stored. The person draws anywhere, and moves around with the Hand tool, the wheel, two fingers or Space + drag.
_Avoid_: board, grid, infinite grid, sheet

**Piece**:
A set of beads that touch by a side or a corner. Pieces form, merge and split as beads are painted and erased. Each Piece belongs to exactly one Piece area.
_Avoid_: island, cluster, group, shape

**Piece area**:
The rectangle around one or more Pieces, with, while there is no Frame, its own rulers. Each Piece's area counts as everything within one bead outside its own bounds; Piece areas whose rectangles overlap, lie inside or touch once that margin is included join, repeated until none do, so Pieces with one empty bead between them share one rectangle and one set of rulers while two or more empty beads keep them apart, and a large Piece never shows smaller Pieces' rectangles inside or against its own. The margin only decides what joins; the drawn rectangle stays around the beads. Forms, merges and splits as beads are painted and erased. The Rulers toggle shows or hides it; the Frame is never hidden by it.
_Avoid_: group, cluster, island

**Frame**:
The one rectangle per Open canvas, on whole beads, that marks which beads are the Pattern. A line, plus a **keep-out margin** (below): drawing outside it stays possible beyond the margin and is saved with the Project, but Export, Beads needed, Row progress and Rotate read only what is inside. With a Frame the Pattern has a size (the Pattern size) . Set, moved, resized and removed as Undo steps that never change a bead. A Project from before the Frame opens with a Frame the size of its old grid.
_Avoid_: border, crop, artboard, page, grid size

**Keep-out margin**:
The 3 bead positions all the way round a set Frame, outside its line (ADR 0027, ticket 261), drawn flat: a gap in the grid dots, with a dashed outline that shows only while the Frame is being set, moved or resized and for 1s after a press in it is refused; the pointer shows not-allowed there. Nothing can be drawn there: Paint, Fill, Paste, Mirror and Rotate all leave it empty (a stroke across it paints only the beads outside it, still one Undo step); Erase still works on anything. Setting, moving or resizing the Frame, and Rotate, move any Piece that reaches it clear, outward, with a Message and one Undo step. Removing the Frame removes the margin. Projects saved with beads in a margin open unchanged; those beads are dealt with the first time the Frame is edited. Export, Beads needed and Row progress count the Frame only, so they ignore it.

**Set Frame**:
The mode (6, or the Frame row in the Toolbox) in which dragging on the canvas draws the Frame, snapped to whole beads, with eight handles (four on touch) and a size tooltip. Also: Fit to drawing (wraps every bead) and Remove Frame, and Columns/Rows steppers once set.
_Avoid_: crop, resize, set size

**Hand tool**:
The tool (5) that moves the view by dragging and never changes a bead. Space + drag does the same from any tool.
_Avoid_: pan mode, grab tool

**Rulers toggle**:
The button (and R, and the phone's zoom pill) that shows or hides every ruler and size marking on the canvas, and the Piece areas' rectangles — each Piece area's, the Frame's and the Frame's size tooltip while it is set — kept as a preference on the device like the theme. Rulers show column numbers above and row numbers left of each Piece area, from 1, or the Frame's on all four sides once a Frame is set.
_Avoid_: ruler switch, numbers toggle

**Canvas color**:
The background of the drawing area, picked by the person from the Canvas color button in the canvas strip: five in light, six in dark, stored as a number so a change of theme keeps the position. A preference on the device like the theme: not saved with a Project and not in exports, which always print on the light board. High contrast has one white canvas and no button.
_Avoid_: board color, background theme

**Project library**:
Every Project saved on this device, taken together — what the Saved Projects box lists and what a library Project file exports in one go. It is ordered by last save, most recently saved first, with no grouping or nesting: saving a Project (any change to it, or Save) moves it to the front, a new or imported Project starts there, and a library saved before the order existed is put in order by when each Project was last changed (ticket 145). A Project belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Project file. Saves itself as it changes, so the Toolbox's Save only reassures on the device side: it writes at once and says "Saved", or says so if the device refuses (ticket 115). Save also hands over the open Project as a Project file, so a Project can be opened on another device without a separate Export (ticket 119). Every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in the top bar and keeps the change on screen rather than losing it silently. Importing while a Project is open asks first whether to switch to the imported Project (saying the current one's progress is saved, or, after a failed save, offering to save it first); either way the imported Project joins the library, and with no Project open it opens without asking (ticket 154). The Saved Projects box asks too: the remove × asks "Remove this Project?" in a danger confirmation, and picking a different thumbnail asks "Switch Project?" naming both, with the same save-first offer after a failed save; picking the open Project does nothing (ticket 232). See [ADR 0012](docs/adr/0012-saving-follows-the-pattern-library.md).
_Avoid_: collection, gallery, saved list, workspace

**Maker's name**:
Who made the Projects on this device: an optional name, at most 40 characters, printed on every PDF and PNG export. It belongs to the person, not to a Project, so it is kept on the device like the theme and never sent anywhere (ADR 0001); it is set from the Export menu's last row, "Name on exports", and the exports leave it out while it is empty (ticket 161). A Project can override it with its own maker's name, set from the New Project form and blank by default regardless of the device-wide value; set, it replaces the device-wide name on that Project's exports and background watermark, alongside the Project's own name, and it travels with the Project (export, import, another device) rather than staying behind on this one (ticket 182).
_Avoid_: author, owner, signature, user name

**Palette**:
A free-standing set of colors used to paint project cells: twelve built-in colors, followed by the Custom colors that have joined it (up to 28, so at most 40 swatches), in the order they were first used. An added swatch can be removed again (never a built-in one); painted cells keep their color, and an Undo toast puts it back. Independent from the bead catalog — a cell's color is not required to correspond to a real bead. The added colors are kept on the device, not in a Project; only the built-in ones have keyboard shortcuts. See [ADR 0025](docs/adr/0025-palette-grows-with-used-custom-colors.md).
_Avoid_: color scheme, fixed palette

**Bead**:
A catalog entry for a specific real bead: brand, name, size, form factor, and color (e.g. Miyuki Delica 11/0), plus its physical footprint in mm (used to convert an mm/cm size into a grid when a Project is created, and to work out an Estimated size — see ticket 01). Width runs along the thread (the bead's length through its hole) and height across it (its diameter), so TOHO Round 11/0 is 1.5 × 2.2mm, not a 2.2mm ball. A Bead may carry a per-bead width correction (mm added to each column for thread and slack, measured rather than published — currently 0.15mm on TOHO Round 11/0), so a column is `widthMm + widthCorrectionMm` wide. The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: seed bead type, item

**Form factor**:
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a project cell.
_Avoid_: bead shape

**Technique**:
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a project's cells. A project has exactly one technique and one bead catalog entry for its entire grid.
_Avoid_: stitch, weave type

**Row progress**: With an Open canvas it works on the Frame's rows only (the finished-row lock covers the Frame only); with no Frame the Progress bar says "Set Frame to start" and offers Set Frame.
An overlay toggled on top of the project editor (not a separate mode) that tracks which rows have already been woven: a sequential "current row" pointer, movable backward, with finished rows shown dimmed, the current row distinctly highlighted, and remaining rows in normal colors. While it's on, finished rows are locked: no drawing command (Paint, erase, Fill, Paste, Mirror) changes them, though Undo still restores an earlier grid in full. Clear project is the exception: it clears Row progress along with the grid. The Frame cannot be changed, and Rotate waits, while it is on. Saved together with the project. Every control for it — the switch that turns it on, Row direction, the pointer readout and the buttons that move the pointer — lives in the Progress bar along the canvas box's bottom edge (ticket 144).
_Avoid_: progress bar (as a name for this overlay/mechanic — it isn't a fill/percentage visualization, which is exactly what "Progress bar" is reserved for instead, see Progress bar), completion state

**Row direction**:
Which way the weaver's rows run across a Project's grid for Row progress: along the grid's rows, or down its columns. Each direction keeps its own current-row pointer. Independent of rotating the Project, which only turns the picture on screen: after rotating, the weaver flips Row direction too, but neither ever changes the other.
_Avoid_: progress orientation, row rotation

**Progress bar**:
The bar along the canvas box's bottom edge that holds every Row progress control (ticket 144): a Show row progress switch, the "Row 12 · of 30 · top to bottom" readout, a track filled with the finished share, Turn row direction, Row not done (moves the pointer back one) and Row done (marks the row finished and moves on). Always there while a Project is open, whatever its shape, because its switch is how Row progress is turned on; while Row progress is off only the switch and its label show, and the bar keeps its height. Separate from the Row progress marker drawn on the grid (the current-row outline).
_Avoid_: progress control, row control

**Mirror**:
A symmetric-drawing aid for a Project. Each direction (left–right and top–bottom) has its own count of Mirror axes, from 0 (off) up to one fewer than the cells across that direction. N axes split the grid into N+1 equal strips (an axis may run through the middle of a cell, which then mirrors onto itself); painting a cell with the Paint tool also paints its counterpart in every other strip. By default neighbouring strips are mirror images of each other (A | A′ | A); a copy mode, one switch for both directions, instead repeats the strip unflipped (A | A | A). Directions are as seen on screen, so rotating the Project swaps the two counts. Axes are drawn as faint lines on the canvas while either count is above 0. A separate "Mirror current" action per direction does a one-time sync of what's already painted, copying the strip with the most painted cells onto the rest (1 center axis if that direction's count is 0), honouring copy mode; hovering it shows the axes and dims the cells it would overwrite. Axis counts and copy mode are an editing-session setting, reset when switching Projects or when the Frame changes. Fill and Clear project are not affected by Mirror; Paste now is — see Paste.
_Avoid_: reflect, symmetry mode, apply mirror

**Toolbox**:
The fixed-width rail of editing controls down the left of the app shell while a Project is open (no wider than 200px, thinner on a tablet), made up of Tool groups stacked vertically. Takes the left column in turn with the New Project form. Stays pinned near the top of the viewport while the canvas is in view, so it stays reachable while working on the lower rows of a Project taller than the screen, and un-pins once the canvas has scrolled past.
_Avoid_: tool strip, toolbar, above-canvas panel

**Tool group**:
One titled box within the Toolbox gathering related controls — e.g. Tools (Paint, Fill, Select, Eraser), Colors, Edit (including Save, QR export and PNG and PDF export), Mirror, Size. Lays its controls out four to a row (three on a tablet) and holds at most 16 in view (four rows of four); a group with more shows that it has more and expands in place, downward, while the pointer is inside it.
_Avoid_: subbox, card, section, panel

**Tool button**:
A Tools-group tool shown as an icon-only square button (Paint is a pencil), four to a row, with no text label: its name, its shortcut and, where the tool needs one, a one-line description appear in its Tooltip. Every tool has a digit key, 1 to 6 in the order Paint, Fill, Select, Eraser, Hand, Frame (7 to `=` are left free for later tools; ticket 292), shown as a small badge beside the icon on every device. The letters E, H and F no longer pick tools. The name stays as the button's accessible name.
_Avoid_: tab, tool tab

**Tooltip**:
The design system's hover (long-press on touch) help for an icon-only control: a bold name, the shortcut as a key chip and, only where the control needs it, a description line. Replaces the browser's native title on Toolbox buttons. A disabled control shows none. A Tooltip is never clipped (ticket 265): its bubble opens in the browser's top layer, outside every column, sheet and canvas that holds its button, on the side of the button that has room (above near the bottom of the screen, below near the top), inside the screen on all four edges, and wraps at a maximum width (the wide-tooltip measure, 15rem) instead of running in one long strip.

**Eraser**:
The 4th Tools-group tool, selectable by clicking its own button alongside Paint, Fill and Select: its primary press/tap erases a single bead under the pointer, dragging to erase a line, the same way right-click erase already worked (ticket 176 — renamed from "Erase" and switched from its original flood-erase primary behavior, so it works on touch/phone without needing a right-click). Behaves like every other drawing command — one undo step per stroke, respects the Row progress lock, and honours Mirror (erasing a cell also erases its mirrored counterpart(s)). Right-click erase is still available under Paint and Fill (single-cell/dragged-line under Paint, flood-erase under Fill) for erasing without switching tools; under Eraser itself, right-click is now redundant with the primary press. Its key is `4` (ticket 292; it was `E` from ticket 250), alongside `Del`, which also erases a Selection.
_Avoid_: erase mode, clear tool

**Clear**:
Resets the open Project to how it was when first created at its size: every cell empty and Row progress turned off with its pointers back at the first row, after a confirmation. The Project's name, size, Technique, Bead and rotation are kept. One undo step, which brings back both the grid and Row progress. Unlike other drawing commands it ignores the Row progress lock, since clearing progress is part of what it does.
_Avoid_: delete all, reset, wipe

**Pattern size**:
How big a Pattern is: its Frame's columns × rows, counted in beads (a Project with no Frame has no Pattern size yet). A size given in mm/cm is converted to whole beads when the Project is created, and is not remembered. Not limited in size beyond what the device can hold (see [ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cap ADR 0017 set).
_Avoid_: dimensions, resolution, physical size

**Rotate**:
Turns the Frame and the beads inside it a quarter turn about the Frame's centre (ADR 0026, which replaces the view-only turn of ticket 171). A Piece in the way moves clear of the Frame, with a Message and one Undo step. Disabled, named "Rotate, Set Frame first", with no Frame.
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
A Tools-group tool, next to Eraser, that removes the specific row or column of the Frame the Selection marks out, from any index, shifting the Frame's beads after it to close the gap and shrinking the Frame by one, as one undo step. Beads outside the Frame stay where they are. Enabled only when the Selection is exactly one whole row or column of the Frame (a ruler number selects one; see Selection); refused while Row progress is on, which holds the Frame's rows still.
_Avoid_: delete row, delete column, shrink

**Replace Bead**:
Swaps a Project's single Bead for a different catalog entry, after a confirmation that shows how the Estimated size changes. The Pattern size and every painted cell stay as they are, whichever unit the Project was created in — see [ADR 0017](docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), superseding [ADR 0008](docs/adr/0008-replace-bead-recalculates-grid.md).
_Avoid_: change bead, swap bead, resize pattern

**Custom color**:
A paint color chosen freely with the color picker in the Colors group. The first time it paints a cell it joins the Palette as a new swatch (unless its hex is already a swatch, or 28 have been added), and from then on it is an ordinary Palette swatch. Until it is used it is only the picker's current color, and choosing another replaces it. Cells keep the hex, so a Project opens with its colors on a device that lacks the swatch.
_Avoid_: user color, extra palette color, one-off color

**Selection**:
A rectangular area of a Project's cells, marked out by dragging with the Select tool, or by clicking a number on the row or column ruler (which marks out that whole row/column, from any tool), and left highlighted once made. Exactly one is active at a time: a new drag or ruler click replaces the previous one, and leaving the Select tool, switching or creating a Project, making a Copy, or right-clicking the canvas or pressing Escape while nothing is copied clears it (an Escape with no Selection, paste preview or open disclosure left to dismiss switches to the Paint tool instead). It marks out cells, it does not change them — selecting never paints anything.
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
The one thing that draws a Project's cells — for the editor, the Convert image preview and the exports — so a bead looks the same wherever it appears. Draws whatever part of the Project is in view, at the current zoom and rotation, in the Technique's geometry.
_Avoid_: grid component, exporter, preview renderer

**Drawing surface**:
What the Project renderer draws on inside the canvas panel: a base layer holding the cells, and an overlay layer holding everything that comes and goes with the pointer — hover preview, Selection, Mirror axes, paste preview and the Row progress marker. It is not the "canvas" of the App shell layout, which is the panel that holds it.
_Avoid_: canvas (that is the panel), bitmap, canvas element

**Overview**:
The page outside the editor, at its own address, that introduces bd-beads feature by feature to someone new to it. There are no accounts, so "new" means only that this device's Project library is empty.
_Avoid_: landing page, home page, about page, marketing page

**Tour**:
A skippable walk through the real editor that takes a new user from nothing to their first Project, one step at a time: each step points at one control, says what it does and asks the user to use it, and moves on once they have. The Project it builds is a real one in the Project library, not a practice copy.
_Avoid_: onboarding, tutorial, walkthrough, guide, coach marks

## How to run it

[Add build/run instructions here as you develop.]

## Where to start

[Point new readers to the most important files or projects in the codebase.]
