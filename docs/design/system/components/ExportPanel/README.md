# ExportPanel

The Export panel: a small panel from the **Export** button in the Canvas strip's right corner, so a finished drawing is exported without opening the Frame panel (ticket 0652; design canvas "Share panel", link on ticket 0652 in the private docs repo). Designed for desktop; it shows at every width the strip does.

## The button

- The `export` icon (ticket 0847; it was `share`, which read as share or open elsewhere), plain look, the **last** button of the Canvas strip's right slot, after the zoom's Fit, in the strip's right corner (CanvasStrip card). An icon button like Rulers and Undo: 30px (44px on a coarse pointer), 18px icon, radius-sm, no fill.
- Shown with a Project open, with or without a Frame. Name and Tooltip "Export", no body and no key.
- Lit while its panel is open: an `ink` fill with a `canvas` icon, as Menu, Project and Frame are while theirs is open. A press while open closes it.

## Panel

- The shell, density and parts of Menu, Project and Frame (MenuPanel card): one of the four open at a time, Escape or a press outside closes it, focus returns to the button. It opens without focusing a field, like the Frame panel.
- `panel-width-small` (360px) wide, never wider than the screen less its 8px gutters. It hangs 4px under the button with its **right** edge on the button's, since the button is in the strip's right corner.
- A `dialog` named "Export". Its title line is `export` in the `label` style, `muted`, lowercased by style, as the Frame panel's `frame` (a section header takes no colon, `writing.md`). No section header and no collapse: it holds one section.

### With a Frame

The Frame panel's export section, the same component, under the title line:

- **Picture** (`image`) and **Printable chart** (`pdf`) PanelItems, each with its File size estimate in the value slot ("PNG ≈ 1.4 MB · 1 file", "PDF ≈ 3.2 MB · 9 pages"; QualitySlider card). The Printable chart's count is what will come out, "1 page", "3 pages", read from the PDF's own plan (`pdfPageCount`: page 1, its list pages, the chart pages, the Word chart pages), so it is the count the PDF's footers print. It changes at once with the Frame, the colors and either switch below (ticket 0916).
- **Large beads** and **Row by row** (ticket 0916), the Printable chart's two switches, right under it, before Export quality: each a PanelSwitchRow, as Letters is in the Frame panel (the name in `control`, an Info button right after it, the AppSwitch at the right, the panel's item height and 10px side padding). Both off at first, and remembered on the device (not with the Project), so the next export of any Project keeps them. They stay live while an export runs: an export reads them when it starts. No line under either switch; what each does is behind its Info button (read once).
  - **Large beads** ("What Large beads does"): every bead on the PDF's charts, page 1's whole chart and strips included, is `print-bead-large` (3 mm) or more, at the cost of more pages: a 100 × 100 becomes the overview and parts. The PNG is page 1, so it follows too.
  - **Row by row** ("What Row by row does"): the Word chart pages follow the chart (PrintWordChart card), whatever Letters says; off, there are none. PDF only.
- No other print setting (paper, margins, overlap, symbols): those belong to pattern sellers' tools (research: PDF export rework, section 3).
- The **Export quality** QualitySlider under them, `space-8` below the last row.
- While an export runs the buttons and the slider are disabled and the LoadingState line shows, as in the Frame panel.
- Once the file is handed over, the saved-file toast names it ("Saved: sunflower.png", Message card) and starts 8px under this panel, never over its rows (ticket 0859), on a phone too.
- Letters stays in the Frame panel only.

### With no Frame

No export buttons and no slider. Under the title line:

- One `meta-small` `muted` line: "Set a Frame around the drawing you want to export."
- **Select a Frame** (`select`): closes the panel and makes Select the tool; the next drag becomes the Frame on release (Frame card, ticket 0568). Once the Frame is set the notice about dragging closes and this panel opens again, hung from the strip's button, on Picture and Printable chart (ticket 0847). Escape or another tool cancels and the notice closes too; the panel stays shut.
- **Fit a Frame to the drawing** (`fit`): disabled with "Nothing is drawn yet to fit a Frame to." while nothing is drawn.

The rows are the Frame panel's own. Fit keeps the panel open, and once the Frame is set it shows the export rows at once; Select a Frame closes it until the drag has set the Frame, then brings it back (ticket 0847), so both ways end at the export rows.

## Copy

Every string is the Frame panel's: Export, Picture, Printable chart, Export quality, Set a Frame around the drawing you want to export., Select a Frame, Fit a Frame to the drawing. The two switches' names, Info button names and bodies are in `writing.md` (Print choices copy, ticket 0916), in both panels.

## Acceptance

- [ ] The Export button is the strip's last button, `export` icon, Tooltip "Export", lit while its panel is open.
- [ ] The panel is 360px, 4px under the button, right edges aligned, and closes Menu, Project and Frame (and they close it).
- [ ] With a Frame: Picture and Printable chart with their sizes, then Export quality, all working as in the Frame panel.
- [ ] Printable chart says how many pages the PDF will have, and the count changes at once with Large beads, Row by row, the Frame and the colors.
- [ ] Large beads and Row by row are off at first and remembered on the device; Letters adds or removes no page.
- [ ] With no Frame: the line, Select a Frame and Fit a Frame to the drawing; no export buttons.
- [ ] The Frame panel's export section and this panel render one shared component.

**From the Progress bar too (ticket 0847; ProgressBar card):** with beads and no Frame, its Fit a Frame and export a picture fits the Frame and opens this panel hung from the strip's button, focused on Picture.

**From the Project panel too (ticket 0843; ProjectPanel card):** its export section's Picture and Printable chart open this panel as the strip's button does, hung from it, with focus on the row chosen; with no Frame the panel opens as usual, on its line and Select a frame.

**From the margin too (ticket 0655; MarginSheet card):** the Frame's margin carries an Export button (`export`, ticket 0847) in its top band. It opens this same panel, hanging 4px under that button with right edges aligned, kept inside the screen.

Hand-written from the ticket 0652 design canvas; static rendition.
