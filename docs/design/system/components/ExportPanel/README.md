# ExportPanel

The Export panel: a small panel from the **Export** button in the Canvas strip's right corner, so a finished drawing is exported without opening the Frame panel (ticket 0652; design canvas "Share panel", link on ticket 0652 in the private docs repo). Designed for desktop; it shows at every width the strip does.

## The button

- The `export` icon (ticket 0847; it was `share`, which read as share or open elsewhere), plain look, the **last** button of the Canvas strip's right slot, after the zoom's Fit, in the strip's right corner (CanvasStrip card). An icon button like Rulers and Undo: 30px (44px on a coarse pointer), 18px icon, radius-sm, no fill.
- Shown with a Project open, with or without a Frame. Name and Tooltip "Export", no body and no key.
- Lit while its panel is open: an `ink` fill with a `canvas` icon, as Menu, Project and Frame are while theirs is open. A press while open closes it.

## Panel

- The shell, density and parts of Menu, Project and Frame (MenuPanel card): one of the four open at a time, Escape or a press outside closes it, focus returns to the button. It opens on its first row, Picture, and ↓ on the Export button opens it as Enter does (ticket 0939); Tab and Shift+Tab wrap inside it.
- `panel-width-small` (360px) wide, never wider than the screen less its 8px gutters. It hangs 4px under the button with its **right** edge on the button's, since the button is in the strip's right corner.
- A `dialog` named "Export". Its title line is `export` in the `label` style, `muted`, lowercased by style, as the Frame panel's `frame` (a section header takes no colon, `writing.md`). Under 1024px, where the strip shows no name, the open Project's name follows it as typed ("export · Loom cuff", one line, ellipsis), as on the Frame panel's title line (ticket 0986). No section header and no collapse: it holds one section.

### With a Frame

The Frame panel's export section, the same component, under the title line:

- **PNG** (`image`) and **PDF** (`pdf`): two buttons side by side, then File (below), a third of the row each, 8px apart, 10px side padding (ticket 1121; they were the Picture and Printable chart PanelItems). Each is an `accent-2` Button (Button card): `accent-2-soft` fill, `accent-2` edge, label and icon, so it reads as a button without the one accent's yellow or orange. On hover (and keyboard focus, and a held press on touch) each Tooltip names the file and says what it gives: "Picture" over "PNG ≈ 1.4 MB · 1 file", "Printable chart" over "PDF ≈ 3.2 MB · 9 pages" (the File size estimate, QualitySlider card). The accessible name says both: "Picture, PNG ≈ 1.4 MB · 1 file". The Printable chart's count is what will come out, "1 page", "3 pages", read from the PDF's own plan (`pdfPageCount`: the Cover page, page 1, its list pages, the chart pages, the Word chart pages), so it is the count the PDF's footers print. It changes at once with the Frame, the colors and either switch below (ticket 0916).
- **File** (`save`), the third button of the row, after PNG and PDF, the same `accent-2` Button (ticket 1121): it saves the whole Project as its `.openbeads` file by the Save Project file action (ADR 0090), as the Project panel's row and Ctrl/⌘ S do, and stays live while an export runs. It needs no Frame, so with none it shows too (ticket 1133; With no Frame, below). Its Tooltip is the action's, "Save Project file" with its key, over "The whole Project in one .openbeads file: its beads, colors, Frame, reference image and settings, to open again here or on another device." (`copy/frame.md`, Export buttons copy); its accessible name says both. The three buttons are a third of the row each.
- **"Saves as"** right under the buttons (ticket 1121; below).
- **Export quality** under "Saves as", folded every time the rows show (ticket 1121; QualitySlider card): one row with its name, Info button, the chosen stop and a chevron, in `accent-2` while folded.
- The three files stand side by side, PNG, PDF then File, and the PDF's and PNG's options under them (ticket 1095; ticket 0957 had put each option under its file): "Saves as", the **Export quality** QualitySlider (it sets the picture only, and its Info note says so), then the switches.
- **Cover page** (ticket 1096), the first switch under Export quality, a PanelSwitchRow like the others, with its Info button ("What Cover page does"). On at first, and remembered on the device. The PDF opens on the Cover page (PrintCover card); off, it opens on Page 1 as before. The page count and the File size estimate follow it at once.
- **Large beads** and **Row by row** (ticket 0916), under Cover page: each a PanelSwitchRow, as Letters is in the Frame panel (the name in `control`, an Info button right after it, the AppSwitch at the right, the panel's item height and 10px side padding). Both off at first, and remembered on the device (not with the Project), so the next export of any Project keeps them. They stay live while an export runs: an export reads them when it starts. No line under either switch; what each does is behind its Info button (read once).
  - **Large beads** ("What Large beads does"): every bead on the PDF's charts, page 1's whole chart and strips included, is `print-bead-large` (3 mm) or more, at the cost of more pages: a 100 × 100 becomes the overview and parts. The PNG is page 1, so it follows too, and the Info body says so: an option that changes both files says it does (ticket 0957).
  - **Shown only where it acts** (ticket 1125): the row is there only when the PDF's plan without it prints a bead under `print-bead-large`. A piece that prints at 3 mm or more already has no Large beads row, not a greyed one: about 60 × 60 and up on a square loom, peyote or brick piece, a 20-bead band from about 115 long, worked out from the plan each time, not a set size. Hidden, it keeps its remembered state but acts as off: the same pages, and no "large-beads" in the file name or the "Saves as" line. It stays hidden until the print code (and the estimate) has arrived.
  - **Row by row** ("What Row by row does"): the Word chart pages follow the chart (PrintWordChart card), whatever Letters says; off, there are none. PDF only.
- No other print setting (paper, margins, overlap, symbols): those belong to pattern sellers' tools (research: PDF export rework, section 3).
- While an export runs the buttons and the slider are disabled and the LoadingState line shows, as in the Frame panel.
- Once the file is handed over, the saved-file toast names it ("Saved: sunflower.png", Message card) and starts 8px under this panel, never over its rows (ticket 0859), on a phone too.
- Letters stays in the Frame panel only.
- **The file name says which switches are on** (ticket 1096). After `{project}-{frame}-{maker}` the PDF's name takes, for each print switch that is on and in the panel's order, an underscore and the switch's file word (`copy/frame.md`, in the app's language): `peacock-cuff-ada-lind_large-beads_row-by-row.pdf`. With every switch off it is the name it had before. The picture's name takes no word. Cover page's word comes first, `_cover`, so the name at first is `peacock-cuff-ada-lind_cover.pdf`. (Black and white adds `_black-and-white` after it once it lands, below.)
- **A "Saves as" line** right under the buttons (ticket 1121; ticket 1096 had it under the last switch): "Saves as" in `meta-small` `muted`, then the PDF's file name as it will be, in DM Mono (`meta`) `ink`, breaking anywhere so a long name wraps inside the panel. It changes at once with each switch. The saved-file toast names the same file.
  - **Its pencil renames the file** (`pencil`, Tooltip "Name this export yourself. …", name "Rename the file"), the ProjectPanel card's line edited in place: a TextField with Save and Cancel, Enter or a press outside saves, Escape cancels. A typed name is saved exactly as typed, ending in `.pdf` once and with the signs a file name cannot hold (`\ / : * ? " < > |`) turned into dashes; no switch adds its word to it while it stands. An emptied name brings the made name back. It is kept nowhere: it lives while the panel's rows are shown and is forgotten once the panel closes. It names the PDF only; the picture keeps its made name.

### Approved 2026-11-19, not yet in the app (ticket 1096)

Until ticket 1096 lands the panel is as written above. Then:

- **One more switch**, **Black and white** ("What Black and white does"), between Cover page and Large beads, a PanelSwitchRow like the others, with its Info button, remembered on the device. The order is then Cover page, Black and white, Large beads, Row by row. Off at first. Every page after the cover is drawn for a black-and-white printer (PrintBlackAndWhite card). It adds or removes no page.
- **Picture saves the Cover page** (PrintCover card), whatever the Cover page switch says, always in color and always one file. No switch changes it, so Large beads' Info body loses "It changes the picture too: the picture is the chart’s first page." and Cover page's gains "It is the page Picture saves."

### Empty grid and Chart border (ticket 1127; in the app)

Signed off by the owner on 2026-11-19 (ticket 1123), Chart border approved on 2026-11-20:

- **Two more switches, Empty grid, then Chart border**, right after Cover page (after Black and white once it lands, ticket 1096), so the order is Cover page, Black and white, Empty grid, Chart border, Large beads (where it shows), Row by row.
  - **Empty grid** ("What Empty grid does"). A PanelSwitchRow like the others, with its Info button; off at first and remembered on the device like them. Off, an empty position on the PDF's charts and overview is bare paper or bare board; on, it gets its outline and small cross (PrintChartPage card). It adds or removes no page.
  - **Chart border** ("What Chart border does"). The same kind of row, remembered on the device, **on at first**. On, every chart has its one rounded rim, 1 mm round the beads with the ruler numbers outside it (PrintChartPage card); off, nothing goes round the chart and the numbers keep their places. It changes the PDF's charts only (not the overview or the Cover page) and adds or removes no page.
- **Their file words**, `empty-grid` and `chart-border` in English (`copy/frame.md`), come after Cover page's (and Black and white's) in the name, in the panel's order, each while its switch is on: `peacock-cuff-ada-lind_cover_black-and-white_empty-grid_chart-border.pdf`. Chart border is on at first, so a name made with the switches as they start ends `_cover_chart-border`.
- While Picture is still page 1 (until ticket 1096's Picture saves the Cover page), the picture is that page, so its chart and overview follow both switches too; their Info bodies don't say so yet, as the Cover page shows no empty positions and no rim and that sentence goes once Picture saves it.

The owner agreed to Empty grid's file word and its place after Black and white, and asked for the rim's switch, on 2026-11-19 (ticket 1123). The owner approved Chart border's name, default, Info body and file word on 2026-11-20.

### With no Frame

No PNG, no PDF and no slider; File stays (ticket 1133). Under the title line:

- One `meta-small` `muted` line: "Set a Frame around the drawing you want to export."
- **Fit a Frame to the drawing** (`frame`; ticket 0944): first once something is drawn, as it is the one-tap way. While nothing is drawn it comes second, disabled with "Nothing is drawn yet to fit a Frame to.". It never carries `fit`, which is the zoom's Fit alone.
- **Drag a Frame** (`select`): closes the panel and makes Select the tool; the next drag becomes the Frame on release (Frame card, ticket 0568). Once the Frame is set the notice about dragging closes and this panel opens again, hung from the strip's button, on Picture and Printable chart (ticket 0847). Escape or another tool cancels and the notice closes too; the panel stays shut. The notice reads "Drag over the Canvas to select the Frame. Escape cancels."; on touch, where there is no Escape key, it ends "Pick a tool to cancel." instead (ticket 0954), as the paste notice does.
- **File** (ticket 1133): under the ways to a Frame, the same `accent-2` button as beside PNG and PDF, a third of the row wide, with its Tooltip; it saves the `.openbeads` file, which needs no Frame.

The rows are the Frame panel's own (one shared component, ExportRows, which the Project panel's Export row also unfolds). Fit keeps the panel open, and once the Frame is set it shows the export rows at once; Drag a Frame closes it until the drag has set the Frame, then brings it back (ticket 0847), so both ways end at the export rows.

## Copy

Every string is the Frame panel's: Export, Picture, Printable chart, Export quality, Set a Frame around the drawing you want to export., Drag a Frame, Fit a Frame to the drawing. The two switches' names, Info button names and bodies are in `copy/frame.md` (Print choices copy, ticket 0916), in both panels.

## Acceptance

- [ ] The Export button is the strip's last button, `export` icon, Tooltip "Export", lit while its panel is open.
- [ ] The panel is 360px, 4px under the button, right edges aligned, and closes Menu, Project and Frame (and they close it).
- [ ] With a Frame: PNG, PDF and File in one row, each with its Tooltip, File saving the `.openbeads` file, then Saves as, Export quality folded, Cover page, Large beads and Row by row, all working as in the Frame panel (ticket 1121).
- [ ] PDF's Tooltip says how many pages the PDF will have, and the count changes at once with Cover page, Large beads, Row by row, the Frame and the colors.
- [ ] Cover page is on at first, Large beads and Row by row off, all remembered on the device; Letters adds or removes no page.
- [ ] Large beads shows only on a piece whose chart would print a bead under 3 mm; on a small piece it is gone and names nothing.
- [ ] With no Frame: the line, then Fit a Frame to the drawing (`frame`) and Drag a Frame, Fit first once something is drawn, then File (ticket 1133); no PNG, PDF or slider.
- [ ] The Frame panel's export section and this panel render one shared component.
- [ ] "Saves as" names the PDF as it will be saved, a word for each switch that is on, at once; its pencil renames it for this export, with no word added, forgotten when the panel closes (ticket 1096).

**From the Progress bar too (ticket 0847; ProgressBar card):** with beads and no Frame, its Fit a Frame and export a picture fits the Frame and opens this panel hung from the strip's button, focused on Picture.

**In the Project panel too (tickets 0956, 1058; ProjectPanel card):** its Export row unfolds this panel's rows in place, under the row, without the title line: the same shared component (ExportRows), with or without a Frame. It does not open this panel. A row named Picture saves the picture at once wherever it is pressed: here, under the Project panel's Export row and in the Frame panel's export section. The strip's Export button, the margin's Export button and the Progress bar's Fit a Frame and export a picture open this panel.

**From the margin too (ticket 0655; MarginSheet card):** the Frame's margin carries an Export button (`export`, ticket 0847) in its top band. It opens this same panel, hanging 4px under that button with right edges aligned, kept inside the screen.

Hand-written from the ticket 0652 design canvas; static rendition.
