# Glossary: Canvas and Frame

The Project, the Open canvas, the Frame, Pieces, zoom and the rulers. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Project**:
Everything saved under one name: the Open canvas with all its Pieces, the Frame, Technique, Bead, rotation, Row progress, Image colors and maker's name. What a person creates, opens, saves, lists in the library, exports as a file and shares. A Project with no Frame has no Pattern yet (ADR 0028, ticket 262).
_Avoid_: design, drawing, chart, pattern (for the whole saved thing)

**Pattern**:
The beads inside a Project's Frame: what the PNG and PDF exports contain, what Beads needed counts, and what Row progress and Rotate work on. Only the word for this; the code has no `Pattern` type, it reads the Frame's beads (`beadsInFrame`). The Overview and Tour say Pattern only for this, never for the whole canvas.
_Avoid_: for the whole saved canvas, which is a Project

**Open canvas**:
What a Project is drawn on: an endless field of bead positions with no board and no fixed size (see [ADR 0026](../adr/0026-open-canvas-and-frame.md)), laid out on the Technique's Grid. Positions are addressed by row and column, negative included, and only painted ones are stored. The person draws anywhere, and moves around with the Hand tool, the wheel, two fingers or Space + drag.
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
The zoom the app's own controls and gestures change (zoom buttons, pinch and Ctrl/⌘ + wheel over the canvas, Ctrl/⌘ + plus, minus and 0), applied to the canvas alone. It is the only zoom there is: the header, the Toolbox, the Dock and every sheet keep their size ([ADR 0034](../adr/0034-only-the-canvas-zooms-page-zoom-is-locked.md)).
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
