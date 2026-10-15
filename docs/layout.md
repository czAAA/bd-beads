# App shell layout

Where everything sits on the screen. Moved out of `CONTEXT.md`'s Key concepts (ticket 358), which keeps a one-line entry. The tiers and their measurements are in the design system's [`responsive.md`](design/system/responsive.md); this file says how the app arranges them.

## The Dock layout (every width)

**The whole screen is the Dock layout at every width** (ADR 0046, ticket 412; ADR 0032 and ticket 295 laid it down for phones), in portrait and landscape: no header, no left column. The canvas starts at the top edge and a slim icon-only Dock (the six tool tiles, the colour button, Pen/Mouse; 48px plus the safe-area inset) sits below it, its sheets holding what the header and column held. With no Project open, the New Project / Import bar replaces the Dock. Menu and Project are the Canvas strip's first buttons (ticket 431). The Frame bar floats at the top-centre of the canvas box. The Frame sheet's Width and Height steppers change a pending Frame that the canvas shows at once and that is committed once, when the sheet closes (ticket 410).

The shell is a notice row (only while there is something library-wide to say), then the canvas box, which takes all the width and the remaining height, then the Dock or the New Project / Import bar. The page itself never scrolls; the Project scrolls inside the canvas box (ADR 0026), and the Progress bar runs along the canvas box's bottom edge.

Read ADR 0021 before adding a new screen or control.

In the Dock layout the Canvas strip stays, one slim row at every width, and owns the canvas controls (ticket 425, ADR 0055): Menu and Project (icon + text, Project with a Project open), then Rulers (R), Undo, Redo, zoom out, the zoom level, zoom in, Fit, then the Canvas color picker last. It has no title, size line, printed-size estimate, grid icon or keyboard hint, and there is no Zoom pill. On a phone the strip shows too, Menu, Project and Canvas color in place and the middle scrolling sideways with touch-sized buttons. The Canvas color picker is not in the Project sheet header. While a picture is being framed (Convert image) the strip holds Menu and the framing step's own zoom. The Dock keeps its width and sits centred; the canvas takes the rest.
