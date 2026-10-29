# ExportPanel

The Export panel: a small panel from the **Export** button in the Canvas strip's right corner, so a finished drawing is exported without opening the Frame panel (ticket 0652; design canvas "Share panel", https://claude.ai/artifact/GyXNWnYHVSMEiA67SZreJ3). Designed for desktop; it shows at every width the strip does.

## The button

- The `share` icon, plain look, the **last** button of the Canvas strip's right slot, after the zoom's Fit, in the strip's right corner (CanvasStrip card). An icon button like Rulers and Undo: 30px (44px on a coarse pointer), 18px icon, radius-sm, no fill.
- Shown with a Project open, with or without a Frame. Name and Tooltip "Export", no body and no key.
- Lit while its panel is open: an `ink` fill with a `canvas` icon, as Menu, Project and Frame are while theirs is open. A press while open closes it.

## Panel

- The shell, density and parts of Menu, Project and Frame (MenuPanel card): one of the four open at a time, Escape or a press outside closes it, focus returns to the button. It opens without focusing a field, like the Frame panel.
- `panel-width-small` (360px) wide, never wider than the screen less its 8px gutters. It hangs 4px under the button with its **right** edge on the button's, since the button is in the strip's right corner.
- A `dialog` named "Export". Its title line is `export:` in the `label` style, `muted`, as the Frame panel's `frame:`. No section header and no collapse: it holds one section.

### With a Frame

The Frame panel's export section, the same component, under the title line:

- **Picture** (`image`) and **Printable chart** (`pdf`) PanelItems, each with its File size estimate in the value slot ("PNG ≈ 1.4 MB · 1 file", "PDF ≈ 3.2 MB · 9 pages"; QualitySlider card).
- The **Export quality** QualitySlider under them, `space-8` below the last row.
- While an export runs the buttons and the slider are disabled and the LoadingState line shows, as in the Frame panel.
- Letters stays in the Frame panel only.

### With no Frame

No export buttons and no slider. Under the title line:

- One `meta-small` `muted` line: "Set a frame around the drawing you want to export."
- **Select a frame** (`select`): closes the panel and makes Select the tool; the next drag becomes the Frame on release (Frame card, ticket 0568).
- **Fit a frame to the drawing** (`fit`): disabled with "Nothing is drawn yet to fit a frame to." while nothing is drawn.

The rows are the Frame panel's own. Fit keeps the panel open, and once the Frame is set it shows the export rows at once; Select a frame closes it.

## Copy

Every string is the Frame panel's: Export, Picture, Printable chart, Export quality, Set a frame around the drawing you want to export., Select a frame, Fit a frame to the drawing. No new copy.

## Acceptance

- [ ] The Export button is the strip's last button, `share` icon, Tooltip "Export", lit while its panel is open.
- [ ] The panel is 360px, 4px under the button, right edges aligned, and closes Menu, Project and Frame (and they close it).
- [ ] With a Frame: Picture and Printable chart with their sizes, then Export quality, all working as in the Frame panel.
- [ ] With no Frame: the line, Select a frame and Fit a frame to the drawing; no export buttons.
- [ ] The Frame panel's export section and this panel render one shared component.

**From the margin too (ticket 0655; MarginSheet card):** the Frame's margin carries an Export button (`share`) in its top band. It opens this same panel, hanging 4px under that button with right edges aligned, kept inside the screen.

Hand-written from the ticket 0652 design canvas; static rendition.
