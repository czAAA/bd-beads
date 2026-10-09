# Convert image fills a Frame of a stated size, framed by its physical shape

**Status: accepted.** Tickets 58, 233, 319.

Convert image creates a new Project from a picture; it is a creation option only, never a drawing command on an open Project. The person states the size, in beads, mm or cm, as for any new Project, and the picture lands in a Frame of that size ([ADR 0026](0026-open-canvas-and-frame.md)). The picture is zoomed and panned under the fixed Frame, never the reverse: the piece is made at the size the maker wants, whatever shape the picture is.

- **The frame follows physical shape, not bead count**, so a non-square bead such as Delica's 1.6 × 1.3mm doesn't distort it.
- **Zoom is clamped so the picture always covers the Frame.** An empty position reads as a deliberate hole, not an artifact of fitting; a transparent background is the deliberate way to a silhouette.
- **Sampling takes each bead's true centre** from the Technique's real geometry ([ADR 0038](0038-techniques-and-their-real-geometry.md)), so peyote's and brick's stagger are reproduced, not flattened.
- **Two row geometries exist on purpose.** Physical geometry (`domain/grid.ts`) is the real piece in millimetres, and the picture is sampled and framed with it; drawn geometry (the Surface view) adds brick stitch's 1px seam between rows, a drawing choice only. The framing drag converts through the Surface view's `beadStep()`, so the point under the pointer stays under it.
- It is built for pixel art and flat artwork, not photographs: no dithering, and HEIC and SVG are refused with a message of their own.

**Considered options**: deriving the height from the picture's aspect ratio (rejected: makes a 4 × 18cm bracelet from a square picture impossible); stretching to fill (rejected: silently distorts flat artwork); allowing zoom below cover (rejected: an accidental zoom-out is indistinguishable from a wanted silhouette); conversion as a drawing command on an open Project (rejected for now: it would need answers for the Row progress lock, Mirror and Undo, for a feature whose value is unproven).
