# The Project is drawn by one renderer on a screen-sized surface, not as a DOM element per bead

**Status: accepted.** Tickets 122, 233, 318.

The editor, the Convert image preview, the Overview and the PNG and PDF exports all draw beads with one **Project renderer** (CONTEXT.md) onto a canvas, so a bead looks the same everywhere. The chrome around it (Toolbox, zoom, lists, dialogs) stays DOM. A DOM element per bead cost about 45ms per hover or paint step at 100 × 100 and 300ms at 250 × 250, because the cost was per cell.

- **The Drawing surface is the size of the screen** (CONTEXT.md): two canvases filling the drawing area, beads below and what comes and goes with the pointer above. It draws only what is in view, so a canvas of any size costs what is on screen. A whole-Project canvas would hit browser canvas-size limits (iPad Safari's is about 16 megapixels) or go soft when scaled.
- **The view is ours, not the browser's scroll.** The open canvas has no edge ([ADR 0026](0026-open-canvas-and-frame.md)), so there is no scroll container: `useCanvasView` owns the zoom and the scroll that says which part of the endless field is shown, and the surface reports wheel, pinch and drag gestures to it.
- **One renderer over two spaces**: the open canvas of the editor, where every position is real, and the Frame alone, for exports, the preview and the Overview, where the Frame's first bead is (0, 0). The overlay takes the same space.
- A single bead's drawing sits behind one function, so a richer bead look can come without rewriting the renderer. Finished rows compute their faded colors directly rather than through canvas filters, which iPad Safari lacks. The look follows the design system ([ADR 0021](0021-visual-language-follows-design-md.md)), checked by screenshot comparison.
- The framing preview reuses the colors from the start of a drag while the picture moves, and draws a coarse look (one flat color per bead) while a big area moves, and recomputes exactly at rest. What is created is what the frame shows at rest.

**Considered options**: a cheaper DOM with `v-memo` and virtualization (rejected: tens of thousands of nodes remain at 250 × 250); SVG (same node count); WebGL (more machinery than colored beads need); native scrolling inside scroll containers (used until the open canvas, then dropped: an endless field has no size to scroll).

**Consequences.** Tests place pointer events at a bead's coordinates and read the result from the Project's state, with hit-testing, the renderer and the overlays tested on their own and a real-browser screenshot comparison on top.
