# Glossary: Library, Palette and Beads

The Project library, the Palette, Beads and their colors, Techniques. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Project library**:
Every Project saved on this device, taken together — what the Saved Projects box lists and what a library Project file (`openbeads_lib.openbeads`, gzipped; ADR 0048) exports in one go. It is ordered by last save, most recently saved first, with no grouping or nesting: saving a Project (any change to it, or Save) moves it to the front, a new or imported Project starts there, and a library saved before the order existed is put in order by when each Project was last changed (ticket 145). A Project belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Project file. Saves itself as it changes, so the Project sheet's Save only reassures on the device side: it writes at once and says "Saved", or says so if the device refuses (ticket 115). Save also hands over the open Project as a Project file, so a Project can be opened on another device without a separate Export (ticket 119). Every command persists the moment it lands, except a dragged paint or erase stroke, which is saved when the button is released. If a save doesn't get through — the browser's storage is full — the editor says so in a notice above the canvas and keeps the change on screen rather than losing it silently. Importing while a Project is open asks first whether to switch to the imported Project (saying the current one's progress is saved, or, after a failed save, offering to save it first); either way the imported Project joins the library, and with no Project open it opens without asking (ticket 154). The Saved Projects box asks too: the remove × asks "Remove this Project?" in a danger confirmation, and picking a different thumbnail asks "Switch Project?" naming both, with the same save-first offer after a failed save; picking the open Project does nothing (ticket 232). See ADR 0012.
_Avoid_: collection, gallery, saved list, workspace

**Offline copy**:
The app itself, kept on the device by the service worker after the first visit, so it opens with no internet or while our hosting is down (ticket 69, ADR 0045). It downloads silently; a newer one waits behind the open page until the person presses Reload in "Update ready", or the app is next opened. It holds no Projects: those are the Project library.
_Avoid_: cache, offline mode, downloaded app

**Keep note**:
The short note shown once per device, at the first time a Project is written to the library and only if the browser doesn't already keep it (ticket 399). It says in plain words that the browser may ask to keep this app's data, to tick "Remember this decision" and choose Allow so Projects survive a device short on space, and that after a decline Projects can still be cleared, so Save often and keep the Project file safe. Its button is what triggers the browser's own prompt; Skip doesn't ask the browser. Either way the device remembers it was shown. Opening the app never asks. A browser without the storage API, or one that decides silently, just never gets the note.
_Avoid_: permission prompt, storage popup

**Maker's name**:
Who made a Project: an optional name, at most 40 characters, printed on that Project's PDF and PNG exports and its background watermark, alongside the Project's own name. It belongs to the Project, not to the device, so it is set per Project (the New Project form, then "Name on exports") and travels with the Project (export, import, another device); there is no device-wide name and no fallback, and an empty name leaves the exports without one (ADR 0060, tickets 161, 182, 441).
_Avoid_: author, owner, signature, user name

**Palette**:
A free-standing set of colors used to paint project cells: twelve built-in colors, followed by the Custom colors that have joined it (up to 28, so at most 40 swatches), in slots: a swatch can be dragged to another slot (or moved with Alt+Left/Right), built-in ones too, and a removed color's slot closes up, so the slots never have a gap. A Custom color joins the last slot when the Custom color picker is left with it or it is taken from the canvas with Pick color from canvas. An added swatch can be removed again (never a built-in one): an added swatch shows a × while it is the active color and while a mouse or an Apple Pencil hovers it or keyboard focus is on it (and Delete or Backspace works on a focused one), which asks for confirmation first; painted cells keep their color, and an Undo toast puts it back. Independent from the bead catalog — a cell's color is not required to correspond to a real bead. The added colors and the slot order are kept on the device, not in a Project; the first twelve slots have the Shift+1…9, Shift+0, Q, W shortcuts, whichever color stands in them. See ADR 0002.
_Avoid_: color scheme, fixed palette

**Bead**:
A catalog entry for a real bead line: brand, name, size and form factor (e.g. Miyuki Delica 11/0), not a color (that is a Bead color), plus its physical footprint in mm (used to convert an mm/cm size into a grid when a Project is created, and to work out an Estimated size — see ticket 01). Width runs along the thread (the bead's length through its hole) and height across it (its diameter), so TOHO Round 11/0 is 1.5 × 2.2mm, not a 2.2mm ball. A Bead may carry a per-bead width correction (mm added to each column for thread and slack, measured rather than published — currently 0.15mm on TOHO Round 11/0), so a column is `widthMm + widthCorrectionMm` wide. The bead catalog is a fixed built-in list of three Beads (TOHO Cube 1.5mm, TOHO Round 11/0, Miyuki Delica 11/0), no longer user-editable — see ADR 0007.
_Avoid_: seed bead type, item

**Bead color**:
One real color of a Bead line, with its maker's code (e.g. TOHO Round 11/0 #25). Decided, not built yet: see ADR 0007.
_Avoid_: bead shade, catalog color

**Color catalog**:
Every Bead color of every Bead line, offered for building a Palette; inside a Project it offers the colors of that Project's Bead, so what Beads needed lists can be bought. Open to everyone, a Guest included. Decided, not built yet: see ADR 0002.
_Avoid_: color library, swatch catalog

**Form factor**:
The physical shape of a bead (e.g. round, cylinder/Delica, cube), which determines the shape of a project cell.
_Avoid_: bead shape

**Brick block**: the number of brick stitch rows woven straight on top of each other before the next rows shift half a bead, 1 to 20, default 1 (today's every-other-row shift). With N, rows alternate in blocks: N straight, N shifted, and so on, so the shift repeats every 2N rows and a Frame starts on, and its top edge moves by, a multiple of 2N rows. Brick stitch only: a stepper beside the Technique choice (new Project form and the Frame menu), hidden for loom and peyote, kept if the Technique is switched away and back. A Project setting saved with the file (older files read as 1); changing it on an open Project is one Undo step that keeps every bead's row and column, and waits while Row progress is on. Its hover text says what it does.

**Net size** (planned): in Netting, the number of beads in one loop, the middle one shared with the next row ("3-bead netting"): an odd number from 3 to 9, default 3, so each side of a diamond holds (Net size − 1) / 2 beads between its shared beads. Netting only, chosen when the Project is created and fixed after, like the Technique, since a diamond with more beads gives the old beads no faithful place; saved with the file.

**Netting** (planned): a Technique woven as an open diamond mesh, in horizontal rows: diagonal strands of beads meet at shared beads, with holes between them. A hole is not a position: nothing paints it, Convert image skips it and no export draws it. Beads are drawn round and untilted at their places on the diamond, shared beads like the rest. A quarter turn of a diamond row is not a row, so Rotate and Rotate Frame are not offered, and Row direction stays on rows (Turn row direction is not offered). A Frame holds whole diamonds only, its edges cutting through shared beads: no foundation row or side turn loops. Vertical netting is not planned yet.
_Avoid_: net, mesh weave

**Right-angle weave** (ticket 482; editing as whole Units ticket 483, Row progress ticket 484): a Technique woven in square units of four beads, each unit sharing its sides with its neighbours, so half the beads lie horizontally and half vertically. Every bead is a position of its own, painted on its own, and drawn the way it lies: horizontal beads turned sideways, vertical beads upright. A Unit's side is a bead's length along its hole plus its width. Positions stay (row, column): rows alternate between a line of horizontal beads (one per Unit across) and a line of vertical beads (one more), so a Frame of U by V Units holds U + 1 columns and 2V + 1 rows, the last column of each horizontal line empty. Rotate and Mirror turn whole Units, so a quarter turn makes a horizontal bead vertical (not offered until ticket 483). Monastery weave is not planned yet.
_Avoid_: cross weave, RAW (the Russian and Belarusian UI may call it "крестик")

**Unit** (Right-angle weave: ticket 482; Netting planned): the repeating cell of Right-angle weave (a square of four beads) or Netting (one diamond); what columns and rows count in those Techniques, so a Project's size, the Frame, the rulers and Row progress count Units and the Frame snaps to whole Units, while Bead quantities count real beads. Loom, peyote and brick stitch have no Units: there columns and rows count beads.
_Avoid_: cell, square, diamond (as a size)

**Technique**:
The weaving method used (loom, peyote, brick stitch, Right-angle weave; Netting planned), which determines the grid geometry/offset of a project's cells. A project has exactly one technique and one bead catalog entry for its entire grid. It is chosen when the Project is created and can be changed on an open Project from the Frame menu (ticket 351): only the geometry changes (row shift and row pitch), so the Schema keeps its columns, rows, Bead and Frame and every cell keeps its row and column (a picture drawn for one technique will look different in another). A Frame that began on an odd row takes in the row above when the new technique is peyote or brick stitch, which start on a multiple of the shift's cycle (an even row, or a multiple of 2N rows on brick stitch with a Brick block of N). One undo step; waits while Row progress is on. Only loom, peyote and brick stitch switch among each other: Right-angle weave and Netting are fixed when the Project is created, since their positions mean nothing in another Technique.
_Avoid_: stitch, weave type
