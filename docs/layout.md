# App shell layout

Where everything sits on the screen. Moved out of `CONTEXT.md`'s Key concepts (ticket 358), which keeps a one-line entry. The tiers and their measurements are in the design system's [`responsive.md`](design/system/responsive.md); this file says how the app arranges them.

## 1024px and wider

The canvas box holds a Canvas with a canvas strip, the Hand/Set Frame tools, a Rulers toggle and the canvas hint (ADR 0026).

The screen is a header, a notice row under it (only while there is something library-wide to say), then one left column that scrolls on its own beside the canvas box, which takes all the remaining width and height. The page itself never scrolls; the Project scrolls inside the canvas box.

The left column holds separate boxes in a fixed order: the Toolbox (or the New Project form in its place, with no Project open or during Convert image framing), the save box, Beads needed, Saved Projects.

The header's summary holds the open Project's info alongside New Project and the Import controls. Zoom sits at the canvas box's top-right; the Progress bar runs along the canvas box's bottom edge.

Read ADR 0021 before adding a new screen or control.

## The Dock layout (every width; with the flag off, under 1024px)

**With `DOCK_LAYOUT_ENABLED` on (ADR 0046) the whole screen is the Dock layout at every width; with it off, under 1024px**, in portrait and landscape (ADR 0032, ticket 295): no header, no left column. The canvas starts at the top edge and a slim icon-only Dock (Tool, Colour, Frame, Project, Menu; 48px plus the safe-area inset) sits below it, its sheets holding what the header and column held. With no Project open, the New Project / Import bar replaces the Dock. The Frame bar floats at the top-centre of the canvas box. The Frame sheet's Width and Height steppers change a pending Frame that the canvas shows at once and that is committed once, when the sheet closes (ticket 410); the Toolbox layout's Frame row does the same when it closes.

In the Dock layout the Canvas strip stays, one slim row at every width (title, size line, keyboard hint, Canvas color picker; no zoom buttons or Rulers toggle, which the Zoom pill owns), and the Canvas color picker is not in the Project sheet header. The Zoom pill floats over the open Project only, so while a picture is being framed (Convert image) the strip keeps its own zoom buttons instead — the one state where it still has them. The Dock keeps its width and sits centred; the canvas takes the rest. With the flag off, 1024px is the only split between the Dock layout and the Toolbox layout (header, left column, Toolbox), and the strip is hidden under it.
