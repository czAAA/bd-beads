# App shell layout

Where everything sits on the screen. Moved out of `CONTEXT.md`'s Key concepts (ticket 358), which keeps a one-line entry. The tiers and their measurements are in the design system's [`responsive.md`](design/system/responsive.md); this file says how the app arranges them.

## 1024px and wider

The canvas box holds an Open canvas with a canvas strip, the Hand/Set Frame tools, a Rulers toggle and the canvas hint ([ADR 0026](adr/0026-open-canvas-and-frame.md)).

The screen is a header, a notice row under it (only while there is something library-wide to say), then one left column that scrolls on its own beside the canvas box, which takes all the remaining width and height. The page itself never scrolls; the Project scrolls inside the canvas box.

The left column holds separate boxes in a fixed order: the Toolbox (or the New Project form in its place, with no Project open or during Convert image framing), the save box, Beads needed, Saved Projects.

The header's summary holds the open Project's info alongside New Project and the Import controls. Zoom sits at the canvas box's top-right; the Progress bar runs along the canvas box's bottom edge.

Read [ADR 0021](adr/0021-visual-language-follows-design-md.md) before adding a new screen or control.

## Under 1024px: the phone layout

**Under 1024px the whole screen is the phone layout, in portrait and landscape** ([ADR 0032](adr/0032-everything-under-1024px-is-the-phone-layout.md), ticket 295): no header, no left column and no canvas header strip. The canvas starts at the top edge and a slim icon-only Dock (Tool, Colour, Frame, Project, Menu; 48px plus the safe-area inset) sits below it, its sheets holding what the header and column held. With no Project open, the New Project / Import bar replaces the Dock. The Frame bar floats at the top-centre of the canvas box.

1024px is the only split between that layout and the desktop one.
