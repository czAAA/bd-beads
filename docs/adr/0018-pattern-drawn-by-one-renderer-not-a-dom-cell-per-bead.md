# The Pattern is drawn by one renderer on a drawing surface, not as a DOM element per bead

> Since [ADR 0028](0028-a-canvas-is-a-project-a-pattern-is-what-the-frame-holds.md) the saved thing is called a Project; "Pattern" below means that, and the text keeps its original words.

_Amended by [ADR 0021](0021-visual-language-follows-design-md.md): "the look does not change" held for the move to the renderer. The redesign then changes the look on purpose: a board behind the beads, per-theme colors, and light finished rows fading toward the board ([DESIGN.md](../../DESIGN.md) §7). The reference images are regenerated once for it and are held to the new look from then on._

The editor grid and the Convert image framing preview each rendered one positioned DOM element per bead. That is fine for a small Pattern and unusable for a large one: measured on a production build, a hover or paint step cost about 42–50ms at 100 × 100 and about 280–320ms at 250 × 250, and a framing drag about 50–60ms at 60 × 90 and up. The cost is per cell, and a hover alone re-rendered every cell. It was the reason ADR 0017 had to cap a Pattern at 10,000 cells. We decided to draw the Pattern with a single **Pattern renderer** onto a **Drawing surface** (see CONTEXT.md), and to keep only the chrome (rulers, Toolbox, zoom, lists, modals) as DOM.

**The surface is viewport-sized.** It draws only the cells in view and is redrawn on scroll and zoom, inside the scroll containers and zoom box the canvas panel already has. A whole-Pattern canvas would hit browser canvas-size limits (iPad Safari's is roughly 16 megapixels; a 250 × 250 Pattern at 300% is 15,000px square) or go soft when scaled, and beads must stay crisp at every zoom. Cost then follows what is on screen, not the Pattern's size.

**The look does not change.** The bar is "visually indistinguishable" from the DOM rendering, checked by screenshot comparison of fixture Patterns (each Technique, Row progress, Selection, Mirror axes; several zooms; rotated). A single bead's drawing sits behind a replaceable function so a richer bead look can come later without rewriting the renderer, but none is built now. Dimmed finished rows compute their greyscale colours directly rather than rely on canvas filters, which iPad Safari lacks.

**Considered options**: keeping the DOM and making it cheaper with `v-memo`, per-row updates and off-screen virtualization (rejected — it still leaves tens of thousands of nodes at 250 × 250, which is the size the phone and tablet targets need to handle); SVG (same node-count problem); WebGL (more machinery than coloured squares need); replacing native scrolling with our own pan and zoom (rejected — it would rewrite Space-drag pan and the page-scroll behaviour for no gain over a viewport-sized surface).

**Consequences.**
- Cells are no longer elements, so the tests that found them in the DOM (143 references to `grid-cell` before this work) place pointer events at a bead's coordinates and read the result from the Pattern's state and the state the surface is drawn from, with hit-testing, the renderer and the overlays tested on their own and a real-browser screenshot comparison against the references made from the old grid. No behaviour test was deleted without an equivalent.
- The framing preview reuses the palette from the start of a drag while the picture is being dragged, and recomputes exactly when it comes to rest, because reducing colours on every move alone exceeds the frame budget. What is created is still exactly what the frame shows at rest.
- The renderer is shared with PNG and PDF export, so a bead looks the same on screen and in an export.
- The stored format, the Pattern file, QR sharing and Undo/Redo, Row progress lock and Mirror behaviour do not change.
- The 10,000-cell cap of ADR 0017 stayed until the editor drew on the renderer, and was then removed by [ADR 0019](0019-a-pattern-has-no-size-limit.md), which records what testing at 70 × 250 and 250 × 250 showed.
