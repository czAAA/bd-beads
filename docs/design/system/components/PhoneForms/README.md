# PhoneForms

New Project and the Convert image wizard on a phone (and, for Convert image, a portrait tablet).

- New Project is the Menu panel's subpanel (MenuPanel card), in the dropdown on a phone too: the primary Create Project button sits under the fields, then "or" and Convert image with its limits line; the system keyboard and pickers do the rest. There is no modal sheet for it (spec 0478).
- The Starter gallery (StarterGallery card) opens from that subpanel's Pick a starter: categories, then a category's options, then one option's setup, each a subpanel level with two columns of picture cards, Create Project in the setup's pinned footer, and Back going up one level (ticket 0595; until ticket 0596, the one-step gallery of ticket 0493).

## Convert image wizard (ticket 0646)

Under 1024 px wide, or in portrait, the wizard (ConvertImage card) is a full-screen sheet on `overlay-fill`, padded by the safe-area insets, instead of the large Modal (built in ticket 0649).

- **Header**, 52: "Convert image" in `title` and Close.
- **Preview**, sticky under the header: 300 tall on a phone (`--convert-preview-phone`), 440 on a portrait tablet (`--convert-preview-tablet`), a 1px `panel-rule` under it. As the sections scroll under it, it shrinks to 132 (`--convert-preview-phone-shrunk`) or 200 (`--convert-preview-tablet-shrunk`) by `transform`, so the sections never reflow; scrolling back to the top grows it again. A uniform scale leaves it narrower than the sheet, so a full-width band of `box` behind it takes the same height, and nothing scrolls into view beside it. The sheet hides its scroll bar, as the panels do. Shrunk, it drops the size tag, the crop handles and the zoom cluster; Treat as empty stays as an icon at the top left, and pinch still zooms the view.
- **Preview controls on a phone:** a 30px-tall row at the top of the preview, above the picture, so nothing covers a bead: Treat as empty at the left (a 30px icon button) and the zoom cluster at the right, compact (24px buttons with 14px icons, the level in `meta-small`, padding 2, no shadow), both 8 from the edges. The picture fits the space under that row. Treat as empty's banner sits at the bottom.
- **Step rail**, 40, under the preview: the five discs, numbers only, each label in its Tooltip (long-press) and accessible name; the section in view keeps its ring.
- **Sections:** one long scroll, padded 12 16 16; on a tablet at most 640 wide, centred. Rows are `panel-row-touch`, PanelPickers and small Steppers `picker-height-touch`. Name and Maker's name stack. Review shows its five totals; the per-color rows sit behind Show details.
- **Footer**, pinned, in thumb reach: the result line in `meta`, centred, over Cancel and Create Project at `field-height-phone` (48), one to two wide. Cancel's question replaces both rows in place (ConvertImage card). A tablet uses the one-row desktop footer.
- **Picture:** Take photo shows on a touch device, and the Note names it in place of Ctrl+V.

Hand-written from the Phase A sign-off (forms, screens and states) and the ticket 0646 design session; static rendition.
