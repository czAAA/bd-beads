# Glossary: Import and rendering

Convert image, the Project renderer and the Bead pointer. Part of the glossary split out of `CONTEXT.md` (ticket 380); the index is [README.md](README.md).

**Convert image**: Needs a size: the picture lands in a Frame of that size on a new Canvas (ADR 0026).
Creating a Project from a picture instead of an empty grid: the picture is shown rendered as beads, and a frame — the Schema itself, sized by its physical dimensions, Bead and Technique — is positioned over it to choose which part is kept. What falls inside the frame is resampled onto the Project's grid and its colors become the Project's Image colors. A way of creating a Project only, never a command that converts into one already open.
_Avoid_: import image, trace, pixelate, image import

**Project renderer**:
The one thing that draws a Project's cells — for the editor, the Convert image preview and the exports — so a bead looks the same wherever it appears. Draws whatever part of the Project is in view, at the current zoom and rotation, in the Technique's geometry. One renderer over two spaces: the canvas of the editor, where every position is real and the Frame sits where it is, and the Frame alone of the exports, the Convert image preview and the Overview, where the Frame's first bead is position (0, 0). The overlay layer is drawn in the same space.
_Avoid_: grid component, exporter, preview renderer

**Bead rim** (ticket 0460):
A faint line just inside every bead's edge (0.75px), so where one bead ends and the next starts shows even when both are the same color. Every theme has one: a dark tint in light and high contrast, a white tint in dark. The same on every bead and in every Technique, 0.75px in the Project's own px so it shrinks with zoom with the bead; exports and printed pages draw their own (light) rim, unchanged. It sits under every overlay (the Frame, the Selection, the Bead pointer, the Row progress marks).
_Avoid_: border, outline (the hover outline is another thing), grid line, gap

**Drawing surface**:
What the Project renderer draws on inside the canvas panel: a base layer holding the cells, and an overlay layer holding everything that comes and goes with the pointer — hover preview, the bead pointer, Selection, paste preview and the Row progress marker. It is not the "canvas" of the App shell layout, which is the panel that holds it.
_Avoid_: canvas (that is the panel), bitmap, canvas element

**Bead pointer** (ticket 353):
What the pointer is over the beads of an open Project, for a mouse: a small bead-shaped marker, 90% of a bead as drawn less 1px (so it follows zoom), centred on the pointer rather than snapped to the bead under it (a hovering pen's stands 18px above its tip and to the side away from the writing hand, set by the Menu's Hand row, Right until Left is chosen and kept on the device, so the hand does not cover it), rounded in peyote and square otherwise, and looking like the hover preview (the chosen color at 60%, else the 2px dark outline; the preview fills only its bead, in the bead's own shape, and on peyote leaves out the part the next row's beads lie over). The OS pointer is hidden there unless a Tool pointer takes its place (every tool has one, so over the canvas the marker is not drawn, for a mouse or a pen); a finger shows none, and a hovering pen has the Tool pointer the app draws instead (ticket 546). The other pointers stay: not-allowed over the Frame's margin, the Hand tool's Tool pointer, grab for Space, and the Set Frame cursor.
_Avoid_: crosshair

**Tool pointer** (ticket 0542):
The pointer over the canvas that shows which tool is in use: a small drawing of the tool (a pencil, an eraser, a hand, the arrow, a bucket, a piece of beads), drawn lightly so it stays out of the painting, with a bead in the current colour on Paint and Fill. Hand's closes while it pans. The files are the design system's `assets/Cursors/`, since the browser calls them CSS cursors. A mouse or trackpad gets it as the CSS cursor; a hovering Apple Pencil gets none from Safari, so the app draws the same file itself at the Pencil's position, hot spot on the tip (ticket 546). That drawing is for hover only (hidden while the Pencil touches the screen, when it lifts away or is cancelled, and when it leaves the board), only for a pointer that draws with the tool (in Mouse mode the Pencil moves the canvas, so it shows the Hand's open hand), and includes the eyedropper's pointer (ticket 0403). Over the Frame's margin and with the Set Frame cursor the Pencil shows nothing, as the hover preview already refuses there. Only a hover-capable iPad (M2 iPad Pro or later, with Pencil 2 or Pencil Pro) sends pen hover; a finger or another iPad shows nothing before contact.
_Avoid_: tool cursor, tool icon (that is the Toolbox button's glyph)

**Letters** (ticket 0573): the Frame panel toggle, off by default and saved with the Project, that prints each bead's Swatch letter on the Frame's beads in the editor, the PNG and the PDF pattern. It never exists as a feature of its own: it only changes the Frame and the export artifacts. It also switches on the Word chart.
_Avoid_: labels, symbols mode

**Word chart** (ticket 0574): the written pattern a weaver follows beside the picture, made when Letters is on: a legend (letter, color name, bead count), then one line per row, such as `Row 3 (R): 2C, 1A, 3*` (a count and a Swatch letter, `*` for empty cells), in the order of Row progress (Row 1 is the first row the Progress bar counts, said in the header). A page after the pattern in the PDF and a second PNG next to the pattern one. For peyote the first line is `Rows 1&2` (the first pass, as the Pass term defines) and every later line is one Pass, with a header saying Even count or Odd count; peyote and brick stitch lines carry an alternating (L) or (R), loom lines read left to right with no marker. Not made for Right-angle weave or Netting. Its words are translated; its letters and numbers are not.
_Avoid_: instructions page, bead list, legend (that is only its first part)

**Export quality**:
The on-device choice, below the export buttons in the Frame panel, of how sharp the PNG and PDF exports are: Low (saves memory), Medium (the default) or High. One choice for both formats: a PNG draws a bead 45, 60 or 90 px across, a PDF page is drawn at 150, 300 or 450 dots per inch. Each stop shows an estimated file size for the open Frame. The exports keep to one pixel ceiling for every device, and a level that would pass it is drawn smaller, which its stop says; a device that cannot hold a 450 dpi page offers no such stop.
_Avoid_: resolution, picture size (confusable with the Frame's size)
