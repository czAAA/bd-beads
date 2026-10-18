# Glossary: Canvas and Frame

The Project, the Canvas, the Frame, Pieces, zoom and the rulers. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Project**:
Everything saved under one name: one Canvas holding the Frame (none or one), the Pieces and any unframed Schemas, plus the Technique, Bead, rotation, Row progress, the Project's name and its Maker's name. What a person creates, opens, saves, lists in the library, exports as a file and shares. A Project with no Frame has no framed Schema yet (ADR 0028, ticket 262).
_Avoid_: design, drawing, chart, pattern, schema (for the whole saved thing)

**Schema**:
A Piece that has a Frame or a name; the word for finished work. A **framed Schema** is the beads inside the Project's Frame, finished and ready for progress: what the PNG and PDF exports contain, what Beads needed counts, and what Row progress works on. A Piece cut by the Frame's edge is a Schema only where it lies inside; the part outside stays a Piece. An **unframed Schema** is a named Piece not yet framed; a Project holds any number of them. A Piece is named with **Name Piece** (ticket 406): select beads of exactly that Piece and choose Name in the selection bar or the Tool sheet; the name is optional text of at most 40 characters like the Maker's name, an empty name takes it off, and one Undo step covers either. The name is drawn under the Piece, kept with the Project (the project file, version 3, keeps it by the position of one bead of the Piece) and follows the Piece through edits: a named Piece that joins an unnamed one absorbs it; a bead that would join two named Pieces is refused and nothing is painted; a Piece that splits keeps its name on the larger part (more beads), the smaller part becoming a plain Piece; erasing every bead of a named Piece deletes its name; Rotate (of a Selection), Remove row/column and a change of Technique carry it along (a Technique change that joins two named Pieces keeps the name of the one with more beads). A named Schema is **framed** with the Selection bar's Frame: select the Piece (Piece tool), choose Frame, and the Frame snaps to its rectangle (ticket 407); doing the same on another named Schema moves the Frame there, and the Schema left behind stays named and unframed, as does one whose Frame is removed. A Frame is refused, with a Message naming the Schema, when it would cut through a named Piece, taking it whole or not at all, like the keep-out margin keeps a Piece whole; an unnamed Piece may still be cut. Setting a Frame over beads does not name them. A Frame still makes a framed Schema without a name (ADR 0050, ticket 404). The code has no `Schema` type: a framed one is the Frame's beads (`beadsInFrame`), an unframed one is `namedPieces` (`domain/pieceNames.ts`). The Overview and Tour say Schema only for this, never for the whole Canvas.
_Avoid_: pattern, chart (all replaced by Schema, ADR 0050); for the whole saved thing, which is a Project; for an unnamed Piece with no Frame

**Canvas**:
The open area a Project is drawn on: an endless field of bead positions with no board and no fixed size (see ADR 0026), laid out on the Technique's Grid. A Project has exactly one. Positions are addressed by row and column, negative included, and only painted ones are stored. The person draws anywhere, and moves around with the Hand tool, the wheel, two fingers or Space + drag.
_Avoid_: open canvas, board, infinite grid, sheet

**Grid**:
The endless arrangement of positions on the Canvas set by the Technique: loom rows stack, peyote rows nest, brick stitch rows are offset by half a bead, a bead apart, in blocks of one or more rows (Brick block). It has no edge and no size; the Frame, not the Grid, gives a Schema its size.
_Avoid_: board, for the beads themselves or for the Schema

**Position marks**:
How the Grid's positions are drawn on the Canvas, in the style chosen as a preference on the device from the Canvas color popover: **Dots** (a dot at each empty position outside the Frame and its keep-out margin, the default) or **Squares** (one shared 1px line in the gap between neighbouring positions, shaped like the Technique's bead, and round every position of the Canvas, a drawn one and one inside the Frame included, ticket 0458). Inside the Frame an empty position is an empty bead instead; the keep-out margin has none. Never in exports.
_Avoid_: grid dots, background dots

**Piece**:
A small, independent set of beads that touch by a side or a corner, drawn on the Canvas. Pieces form, merge and split as beads are painted and erased. Each Piece belongs to exactly one Piece area. A Piece that has a Frame or a name is a Schema.
_Avoid_: island, cluster, group, shape, fragment

**Piece area**:
The rectangle around one or more Pieces, with, while there is no Frame, its own rulers. Each Piece's area counts as everything within one bead outside its own bounds; Piece areas whose rectangles overlap, lie inside or touch once that margin is included join, repeated until none do, so Pieces with one empty bead between them share one rectangle and one set of rulers while two or more empty beads keep them apart, and a large Piece never shows smaller Pieces' rectangles inside or against its own. The margin only decides what joins; the drawn rectangle stays around the beads. A Piece area shows its rectangle and rulers only when its joined rectangle spans more than 4 beads in total (width times height, so a single row of 5 counts and 2x2 does not); smaller ones are not drawn, and beads, Pieces, Export and Beads needed are unchanged. Forms, merges and splits as beads are painted and erased. With no Frame, a whole row or column of one can be selected by a Select-tool drag across it and removed with Remove row/column. The Rulers toggle shows or hides it; the Frame is never hidden by it.
_Avoid_: group, cluster, island

**Frame**:
The one rectangle per Canvas, on whole beads, that marks which beads are the Schema. A line, plus a **keep-out margin** (below): drawing outside it stays possible beyond the margin and is saved with the Project, but Export, Beads needed and Row progress read only what is inside. The first Frame set on a Project turns Row progress on by itself; the Frame then stays resizable until a pass is done, and its size is held still from then until Row progress is turned off or the Project is cleared (ticket 411); it can still be moved, with its beads and the pointer, by the Move handle (ticket 0452, ADR 0062). With a Frame the Schema has a size (the Schema size) . Set, moved, resized and removed as Undo steps; only a move changes beads (the Move handle carries them), setting, resizing and removing never do. Resized from the Frame row or sheet, the size is applied once: each press of Width or Height shows on the canvas but is not committed until the row or sheet closes (or another command reads the Frame), as one Undo step. A Project from before the Frame opens with a Frame the size of its old grid.
_Avoid_: border, crop, artboard, page, grid size

**Keep-out margin**:
The 6 bead positions all the way round a set Frame, outside its line (ADR 0027, ticket 261; 3 until ADR 0056), drawn flat: a gap in the Position marks (Squares' lines stop at its edge, and run round the Frame's own positions), with a dashed outline that is always shown with the Frame, and that also flashes for 1s after a press in it is refused; the pointer shows not-allowed there. Nothing can be drawn there: Paint, Fill, Paste, Mirror and Rotate all leave it empty (a stroke across it paints only the beads outside it, still one Undo step); Erase still works on anything. It cannot be selected either (tickets 428, 433): a Selection is wholly inside the Frame, wholly clear of the margin, or round the Frame and its margin whole, never anything else, whichever way it is made (one rule, `selectionAllowed`); a drag cannot start in it and is clamped when it ends there, Shift+arrow stops one cell before it, a ruler number selects only the Frame's part of its line, and a Piece tap selects only the tapped bead's side. Beads held in a margin are out of reach of every Selection except one round the whole Frame (so Cut, Clear selection and Copy touch them only then, while Rotate still leaves the margin empty), while Erase still clears them. Setting or resizing the Frame leaves every bead where it is: a bead that lands in the margin stays in the Project, covered by the margin (not drawn there, not counted), and shows again if the Frame later moves off it or is resized. Moving the Frame carries only the beads inside it: beads held in the margin stay where they are, and whatever is under the destination goes under the Frame as **covered beads** (ticket 476, ADR 0065): kept in the Project, not drawn, counted or exported, and back on the canvas as soon as the Frame no longer sits on their cell (a move off, Remove Frame, a resize) and the cell is empty. Painting or erasing above a covered bead leaves it; a named Piece the Frame lands on loses its name. The margin is 6 positions at every zoom (ticket 459 grew it when zoomed out for the corner controls; ticket 473 took those controls out of it). Removing the Frame removes the margin. Export, Beads needed and Row progress count the Frame only, so they ignore it.

**Edit Frame**:
The Frame's edit toggle (tickets 0452, 0473, ADR 0062, amending ADRs 0054 and 0055). One switch with two ways in: the **Frame** button in the Canvas strip and the **edit pencil** at the margin outline's top-right corner (32px chip, 44px hit, inside the margin, never scaling with the zoom, pinned to the corner; a Frame dragged over the canvas box's edge takes it along, it is not pulled back into view). Open, it shows the **Frame bar** and the eight resize handles (four on touch); closed, both are hidden. The bar is closed whenever a Project opens or the Frame is removed, and Frame from Selection leaves it closed; the choice is kept for the session only. Tools work inside the Frame as usual, since the handles sit in the margin, where nothing can be drawn. Once Row progress has started the switch still opens the bar, which then holds the size and Remove Frame alone, with no handles (ticket 0475). The rulers and the dashed margin outline are always shown; the size tooltip shows only while dragging or stepping. A Selection never shows rulers, a margin outline, the pencil, the Margin handle or the bar.
_Avoid_: Set Frame (the old mode, which also drew a Frame by dragging), crop, resize, set size, Edit Frame mode

**Frame bar**:
The panel Edit Frame opens (tickets 0473, 0475), in the same shell as the Menu and Project panels and one of the three at a time: Escape or a press outside closes it, though a press on a Frame handle does not. It hangs from whichever opened it: the Frame button (a dropdown from 1024px, a sheet under the strip below) or the edit pencil (a dropdown under it, or above it with no room below, following it as the canvas pans and zooms). Row 1: the size, a field that takes a typed "20x120" and grows or shrinks both sides evenly about the Frame (the odd bead going right or down; on peyote and brick stitch the top edge moves by pairs of rows), Rotate Frame and Remove Frame (always asks first). Row 2: Top, Bottom, Left and Right cells, each a − and + pair of 48px buttons: one bead per press (a pair of rows on the top edge where rows alternate), hold to repeat, one Undo step, down to four beads.
_Avoid_: Frame toolbar, Frame sheet

_Avoid_: Set Frame (the old mode, which also drew a Frame by dragging), crop, resize, set size, Edit Frame mode

**Rotate Frame**:
A button in the Frame bar, before Remove Frame (spec 0470). Turns the Frame, its keep-out margin and the beads inside both a quarter turn clockwise about the centre of that whole area, like Rotate on a Selection that is round the Frame and its margin; the Frame's Width and Height swap. The same rules as Rotate: beads under the turned footprint are covered (one Message with Undo), the outer margin and finished rows trim it silently, the top row snaps even on peyote and brick stitch, one Undo step, and not offered once a Row progress pass is done (ticket 411). Pieces outside the Frame and its margin stay put; the bar stays as it was. It shares its icon with Rotate and has no key.
_Avoid_: Frame turn (the ADR 0026 Frame turn that moved Pieces)

**Rotate canvas**:
The Canvas strip button before the Rulers toggle (spec 0470, planned). A quarter turn clockwise of the whole picture, like turning a real canvas: only the Project's rotation changes, no bead, Frame, name or margin moves, so peyote and brick stitch turn without any row snapping. A view setting like Row direction: saved with the Project, not an Undo step, not in exports, not blocked by Row progress, and independent of Row direction. Its icon is the Rotate icon with a small canvas badge; no key.
_Avoid_: Rotate view, turn picture

**Margin handle**:
The Frame's move grip (tickets 0452, 0455, 0473): a horizontal line in the middle of the top margin, always there, bar open or closed, also after Row progress has started. Dragging it moves the whole Frame with its beads (ADR 0062): while it is dragged the beads travel with the Frame on screen, not only its outline; beads at the destination are overwritten, the cells left behind are emptied, the move is not limited, and while the pointer touches the canvas box's edge the view scrolls that way, so the Frame stays in hand; it goes by a pair of rows on peyote and brick stitch, and the Row progress pointer travels with the Frame. One announced Undo step; arrow keys move it a bead and Shift + arrows resize, while it has focus. It never scales with the zoom, stays on the margin's own centre and goes with the Frame when it leaves the view (it is not kept in the canvas box) and slides clear of the pencil and the bar. Resizing never touches a bead.
_Avoid_: Frame drag, drag inside the Frame

**Hand tool**:
The tool (5) that moves the view by dragging and never changes a bead. Space + drag does the same from any tool.
_Avoid_: pan mode, grab tool

**Pen mode** / **Mouse mode**:
The input mode: which pointer draws with the current Tool and which one moves the canvas. In Pen mode the pen draws, and a finger or mouse drags the canvas like the Hand tool, so a palm resting on an iPad does not paint. In Mouse mode (the default) a finger or mouse draws and the pen drags the canvas. Told apart by each event's pointer type, not by the Tool; two-finger pinch, the wheel and Space + drag work in both. One toggle picks it (the Tool pill's last button), offered only once a pen has been seen (the first pen event of a visit, kept on the device), and that first pen switches to Pen mode unless a mode was chosen before; the choice is kept on the device.
_Avoid_: stylus mode, touch mode, palm rejection

**Rulers toggle**:
The button (and R, and the Canvas strip's Rulers button) that shows or hides every ruler and size marking on the canvas, and the Piece areas' rectangles — each Piece area's, the Frame's and the Frame's size tooltip while it is set — kept as a preference on the device like the theme. Rulers show column numbers above and row numbers left of each Piece area, from 1, or the Frame's on all four sides once a Frame is set.
_Avoid_: ruler switch, numbers toggle

**Canvas zoom**:
The zoom the app's own controls and gestures change (zoom buttons, pinch and Ctrl/⌘ + wheel over the canvas, Ctrl/⌘ + plus, minus and 0), applied to the canvas alone. It is the only zoom there is: the Dock and every sheet keep their size (ADR 0034).
_Avoid_: scale, magnify, page zoom (a different thing)

**Page zoom**:
The browser's own whole-page zoom (pinch on the page, double-tap, Ctrl/⌘ + wheel outside the canvas, the browser's zoom menu). The app locks it so the chrome never changes size.
_Avoid_: UI scale, browser scale

**Zoom floor**:
The smallest zoom, 10%, the same on every screen: zoom out, pinch, wheel and Fit all stop there, so a Schema wider or taller than the screen can be seen whole. Fit never goes above 100%.
_Avoid_: min zoom, bead-min floor

**Ruler step**:
How many beads apart the rulers show a number, chosen from 5, 10, 50, 100 and so on as the smallest that leaves every number clear at the current zoom; the beads between are drawn as Ruler dots. The Ruler step applies from 50% zoom up; below 50% a ruler shows only its last number (the column count along the columns, the row count along the rows, on every Frame side and every Piece ruler), and the beads without a number keep their dots.
_Avoid_: label interval, tick spacing

**Ruler dot**:
The small mark a ruler draws for a bead that has no number at the current Ruler step; every 5th is a bolder dot, and, a dot, like a number, is display-only (ticket 447). At a bead pitch too small for a dot per bead, only the 5th-bead dots remain.
_Avoid_: tick, marker

**Ruler layout**:
Everything the rulers are for one view of the canvas, worked out once from the Project and the Surface view: the boxes that carry rulers, the numbers and Ruler dots to draw, and what a point of the viewport selects. The overlay draws it; ruler numbers are display-only (ticket 447), so nothing asks it what a press selects; the Ruler step is chosen once per axis per box inside it. The print rulers (fixed step, no dots) are not part of it.
_Avoid_: ruler view, ruler geometry

**Canvas color**:
The background of the drawing area, picked by the person from the Canvas color button in the canvas strip: five in light, six in dark, stored as a number so a change of theme keeps the position. A preference on the device like the theme: not saved with a Project and not in exports, which always print on the light board. The same popover holds the Position marks toggle (Dots | Squares). High contrast has one white canvas, so its button opens the toggle alone, with no swatches.
_Avoid_: board color, background theme
