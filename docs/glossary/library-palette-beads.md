# Glossary: Library, Palette and Beads

The Project library, the Palette, Beads and their colors, Techniques. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Project library**:
Every Project saved on this device, taken together — what the Saved Projects box lists and what a library Project file exports in one go. It is ordered by last save, most recently saved first, with no grouping or nesting: saving a Project (any change to it, or Save) moves it to the front, a new or imported Project starts there, and a library saved before the order existed is put in order by when each Project was last changed (ticket 145). A Project belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Project file. Saves itself as it changes, so the Toolbox's Save only reassures on the device side: it writes at once and says "Saved", or says so if the device refuses (ticket 115). Save also hands over the open Project as a Project file, so a Project can be opened on another device without a separate Export (ticket 119). Every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in the top bar and keeps the change on screen rather than losing it silently. Importing while a Project is open asks first whether to switch to the imported Project (saying the current one's progress is saved, or, after a failed save, offering to save it first); either way the imported Project joins the library, and with no Project open it opens without asking (ticket 154). The Saved Projects box asks too: the remove × asks "Remove this Project?" in a danger confirmation, and picking a different thumbnail asks "Switch Project?" naming both, with the same save-first offer after a failed save; picking the open Project does nothing (ticket 232). See [ADR 0012](../adr/0012-saving-follows-the-pattern-library.md).
_Avoid_: collection, gallery, saved list, workspace

**Maker's name**:
Who made the Projects on this device: an optional name, at most 40 characters, printed on every PDF and PNG export. It belongs to the person, not to a Project, so it is kept on the device like the theme and never sent anywhere (ADR 0001); it is set from the Export menu's last row, "Name on exports", and the exports leave it out while it is empty (ticket 161). A Project can override it with its own maker's name, set from the New Project form and blank by default regardless of the device-wide value; set, it replaces the device-wide name on that Project's exports and background watermark, alongside the Project's own name, and it travels with the Project (export, import, another device) rather than staying behind on this one (ticket 182).
_Avoid_: author, owner, signature, user name

**Palette**:
A free-standing set of colors used to paint project cells: twelve built-in colors, followed by the Custom colors that have joined it (up to 28, so at most 40 swatches), in the order they were first used. An added swatch can be removed again (never a built-in one): an added swatch shows a × while it is the active color and while a mouse or an Apple Pencil hovers it or keyboard focus is on it (and Delete or Backspace works on a focused one), which asks for confirmation first; painted cells keep their color, and an Undo toast puts it back. Independent from the bead catalog — a cell's color is not required to correspond to a real bead. The added colors are kept on the device, not in a Project; only the built-in ones have keyboard shortcuts. See [ADR 0002](../adr/0002-palette-separate-from-bead-catalog.md).
_Avoid_: color scheme, fixed palette

**Bead**:
A catalog entry for a real bead line: brand, name, size and form factor (e.g. Miyuki Delica 11/0), not a color (that is a Bead color), plus its physical footprint in mm (used to convert an mm/cm size into a grid when a Project is created, and to work out an Estimated size — see ticket 01). Width runs along the thread (the bead's length through its hole) and height across it (its diameter), so TOHO Round 11/0 is 1.5 × 2.2mm, not a 2.2mm ball. A Bead may carry a per-bead width correction (mm added to each column for thread and slack, measured rather than published — currently 0.15mm on TOHO Round 11/0), so a column is `widthMm + widthCorrectionMm` wide. The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see [ADR 0007](../adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: seed bead type, item

**Bead color**:
One real color of a Bead line, with its maker's code (e.g. TOHO Round 11/0 #25). Decided, not built yet: see [ADR 0007](../adr/0007-one-bead-per-pattern-no-color-mapping.md).
_Avoid_: bead shade, catalog color

**Color catalog**:
Every Bead color of every Bead line, offered for building a Palette; inside a Project it offers the colors of that Project's Bead, so what Beads needed lists can be bought. Open to everyone, a Guest included. Decided, not built yet: see [ADR 0002](../adr/0002-palette-separate-from-bead-catalog.md).
_Avoid_: color library, swatch catalog

**Form factor**:
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a project cell.
_Avoid_: bead shape

**Technique**:
The weaving method used (loom, peyote, brick stitch, etc.), which determines the grid geometry/offset of a project's cells. A project has exactly one technique and one bead catalog entry for its entire grid. It is chosen when the Project is created and can be changed on an open Project from the Frame menu (ticket 351): only the geometry changes (row shift and row pitch), so the Pattern keeps its columns, rows, Bead and Frame and every cell keeps its row and column (a picture drawn for one technique will look different in another). A Frame that began on an odd row takes in the row above when the new technique is peyote or brick stitch, which start on an even row. One undo step; waits while Row progress is on.
_Avoid_: stitch, weave type
