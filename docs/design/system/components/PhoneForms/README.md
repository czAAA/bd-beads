# PhoneForms

New Project and the Convert image wizard on a phone (and, for Convert image, a portrait tablet).

- New Project is the Menu panel's subpanel (MenuPanel card), in the dropdown on a phone too: the primary Create Project button sits under the fields, then "or" and Convert image with its limits line; the system keyboard and pickers do the rest. There is no modal sheet for it (spec 0478).
- The Starter gallery (StarterGallery card) opens from that subpanel's Pick a starter: categories, then a category's options, then one option's setup, each a subpanel level with two columns of picture cards, Create Project in the setup's pinned footer, and Back going up one level (ticket 0595; until ticket 0596, the one-step gallery of ticket 0493).

## Convert image page (tickets 0646, 0756)

Under 1024 px wide, or in portrait, the Convert image page (ConvertImage card) keeps the canvas box it has at every size (ADR 0086): there is no full-screen sheet and no header of its own. The strip above it holds Menu and Close, the Progress bar below it the five steps.

- **Preview**, above the step: at most 300 tall on a phone (`--convert-preview-phone`), 440 on a portrait tablet (`--convert-preview-tablet`), never under 160 (`--convert-preview-min`), a 1px `panel-rule` under it. It gives way to the step when the box is short. It does not shrink as the step scrolls: the step scrolls on its own, under the preview.
- **Preview controls on a phone:** a 30px-tall row at the top of the preview, above the picture, so nothing covers a bead: Treat as empty at the left (a 30px icon button) and the zoom cluster at the right, compact (24px buttons with 14px icons, the level in `meta-small`, padding 2, no shadow), both 8 from the edges. The picture fits the space under that row. Treat as empty's banner sits at the bottom.
- **Steps:** on the Progress bar, whose dots take `meta-tiny` names that wrap to two lines on a phone, with Back and Next on a second row, half the bar each (ProgressBar card). The step in hand is one scroll, padded 12 16 16; on a tablet at most 640 wide, centred. Rows are `panel-row-touch`, PanelPickers and small Steppers `picker-height-touch`. Name and Maker's name stack. Review shows its five totals; the per-color rows sit behind Show details.
- **Picture:** Take photo shows on a touch device, and the Note names it in place of Ctrl+V. The buttons sit in aligned columns, one under another where the pane is narrow.

Hand-written from the Phase A sign-off (forms, screens and states) and the ticket 0646 design session; static rendition. The page layout of ticket 0756 replaced the sheet.
