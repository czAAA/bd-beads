# MarginSheet

The Frame's keep-out margin drawn as a sheet of drafting paper: its own background and inner border, the Frame's tools and Row progress in its top band, a title block in its bottom-right corner, and the rulers on three sides (ticket 0655; design canvas "Keep-out margin variants", variant A "Drafting sheet", https://claude.ai/artifact/Aj9Tmr8xpdTfaaKBzLYzeh). It replaces the flat margin and the gutter controls of the Frame card. Built by tickets 0656 (width and color), 0657 (tools, title block, Row progress) and 0658 (zoom forms and folding).

## Width

- **4 bead positions on every side**, fixed, not a setting (was 6). The keep-out rules of the Frame card are unchanged; only the width is.
- 4 is what the content needs at 100% zoom, where a bead pitch is 18px and the band 72px. The top band holds the 10px border inset, the 28px tool row, the column numbers (12px) and 7px to the Frame line: about 64px. The bottom band holds 7px from the Frame line, the 48px title block and the 10px inset: about 65px. The side bands hold the row numbers and the row pointer (about 40px). Three beads (54px) cannot hold the title block; five or more is empty paper.

## The sheet

- **Fill:** the margin color (below) on the whole band, outer corners `radius-lg` (12px; 10px in the compact form). It is opaque over the Canvas and its Position marks; the Frame's own sheet sits on it as before.
- **Inner border:** 1px `margin-line`, inset `--margin-border-inset` (10px; 6px compact), radius `radius-sm`, like the border of a drawing. Nothing else is drawn on the paper: no zone letters, no crop marks.
- **Edge:** a 1px `margin-line` hairline round the outside, so the sheet reads on a Canvas of nearly the same color.
- **High contrast:** the sheet is white with a 2px black border and a 1px `margin-line` inner border.
- **Never in exports:** PNG and PDF print the Frame's beads only, as before.

## Margin color

- **Auto** (the default): the Canvas color one step off, toward white by 5% in dark and toward black by 5% in light, its hue kept: Slate `#3b3e43` gives `#45484c`, Night `#202020` gives `#2b2b2b`, Linen `#f7f3ec` gives `#ebe7e0`, Studio `#fafafa` gives `#eeeeee`. On a Custom Canvas color the step goes toward white when the Project is drawn in the dark look and toward black in the light look (CanvasBackground card). It follows the Canvas color as it changes.
- **Picked:** the standalone `BackgroundColorPicker` (CanvasBackground card, ticket 0653) with an **Auto** swatch first, then the theme's five Canvas colors, then the Palette's Custom color tile. Auto is drawn split corner to corner, the Canvas color and the margin color, so it shows what it does. The swatch equal to the current Canvas color carries a 6px dot (`ink` at 70%) and the name "{color}, the Canvas color"; picking it leaves no margin visible. The chosen one is ringed with a check as in every BackgroundColorPicker.
- **Remembered on the device**, as the Canvas color is: the position for the five, one Custom color for both themes. Not an Undo step.
- **Where:** the Frame panel's new last section, **margin** (PanelSection, after beads needed; summary "auto" or the color's name), and the **Margin color** button on the sheet, which opens the same picker in a popover under it (the shared popover look, 12px padding, `label` "margin color", the swatches, the name and hex line).
- **What sits on it:** text and icons are `ink` and `body`; the rulers take the nearest grey to the look's own `ruler` at 4.5:1 or more against the margin color, the 5th numbers at 7:1, the rule the Custom Canvas color uses.

## Top band

Left to right, 14px in from the sheet's top-left corner (10px compact), 4px apart:

1. **Row progress:** the Progress bar's controls, the same component in a compact form, tracking the same progress (ProgressBar card): Turn row direction, Reset progress, the Row highlight Switch, a 1px divider, the counter ("5/11", `control`), a 64px track, a divider, Row not done (icon only, `arrow-up`, its name and Tooltip the label it has in the bar) and **Row done** (the bar's primary button at 26px, label and trailing arrow). Pressing either moves the one pointer, in the margin and in the Progress bar alike. With no Frame there is no sheet.
2. **Move bar**, centred on the top band: the Frame card's Move handle (40 × 6 `ink` pill in a 56 × 28 hit area, `grab`), now on the paper instead of in the gutter. Same name, Tooltip, keys and Tab stop.
3. **Tools**, at the right, 28px icon buttons (`radius-md`, no fill, hover `ink` at 10%): **Rotate Frame** (`rotate`), **Edit Frame** (`pencil`; on: `ink` fill, `canvas` icon), **Export** (`share`, the Canvas strip's Export: opens the Export panel under this button, ExportPanel card), **Margin color** (`palette`), a divider, **Remove Frame** (`delete`, `ink` on the paper, `danger` on hover and in its confirmation). Each keeps the name, Tooltip, confirmation and disabled reasons it has in the Frame card.

The edit pencil, Remove Frame chip and Move handle no longer stand in the gutter: nothing of the Frame is drawn outside its sheet except the size Tooltip.

## Edit Frame: hot corners

- While Edit Frame is on, the sheet's outer edge is outlined 1px dashed in `accent` at 55%, 3px outside it.
- The eight resize handles are drawn on the Frame line: at each corner an `accent` bracket (two 14px arms, 3px thick, the corner rounded 4px), at each edge's middle a 12 × 4 `accent` bar. Under the pointer a corner grows to 18px arms, 4px thick, on a 32px `accent` disc at 18%, and the size Tooltip shows beside it ("42 × 13 ≈ 6.7 × 1.7 cm"). The hit areas are the Frame card's (14px from the centre for mouse and pen, 24px for touch).
- Editing stays locked once a Row progress pass is done, as before; the Edit Frame button is then not offered.

## Title block

Anchored to the inner border's bottom-right corner, two rows of `--margin-title-row` (23px), 1px `margin-line` rules between cells, filled `margin-title`, its own bottom-right corner rounded with the border.

| Row | Cells, left to right |
|---|---|
| 1 | The Frame's **name** (Inter 600 12, one line, ellipsis; "Name this frame" in `muted` when empty) with a pencil · the **Technique** (Inter 500 12) with a pencil · "by" (`meta-small`) and the **maker's name** (Inter 500 12) with a pencil, over two cells · the **fold** button over both rows |
| 2 | The size in beads ("40 × 11", `meta-small`) · the estimated size ("≈ 6.4 × 1.4 cm") · the **legend**: one 14px disc per Palette color in the Frame, holding its Swatch letter (white on dark beads, `ink` on light, Inter 600 8) · **Letters** and its Switch |

- The pencils are 18px buttons with 12px icons: the name edits in place as in the Frame panel (Save, Cancel, "n/40"); the Technique opens the Project's Technique PanelPicker as a popover, locked with its reason once a row is done; the maker's name is the Project's Name on exports (NameOnExports card), so a change shows in Project and on every export.
- The legend shows at most 8 discs, then "+n". Letters is the Frame panel's Letters setting (saved with the Project): on, the Frame's beads carry their letters, as the PNG and PDF do.
- **Name and size on the margin**, a Switch in the Frame panel's margin section (on by default, remembered on the device), hides the title block; the fold tab then is not shown either.
- **Fold** (`chevron-down`) folds the title block to a tab in the same corner: the name (Inter 600 11) and `chevron-up`, 24px tall, `margin-title` fill. The tab unfolds it. Kept for the session.

## Rulers and the row pointer

- With a Frame, its rulers are drawn top, left and right, none below (the title block's band). Placement, sizes and the 5th-number rule are the Rulers card's; their color follows Margin color above.
- The current row's **pointer**: a 9 × 12 `marker` triangle in the left band, 4px outside the row numbers, pointing at the row; the row itself keeps its ring and the finished rows their dimming (BeadBoard card). It follows Turn row direction (above the columns in the top band when columns run).

## Zoom forms

The tools keep their pixel size while the band grows and shrinks with the beads, so the sheet changes form by the band's height in screen pixels:

- **Full** (band 64px and up, 100% and closer): as above.
- **Compact** (34 to 64px, about 50% to 90%): tools 24px with 14px icons; Row progress shows only the counter, the track and Row done; the title block is one 22px row (name, Technique, size in beads, size in cm, Letters); no ruler numbers, only the Frame line; the inner border inset 6px.
- **Folded** (under 34px): the Move bar, the counter with Row done, the Margin color button and a **···** button ("Frame tools") whose menu holds Rotate Frame, Edit Frame, Export and Remove Frame; the title block is the name tab. The paper keeps its color. Folding by hand (the title block's fold button) folds the title block alone; the tools stay.

## Touch

On a coarse pointer every control on the sheet has a 44px hit area, centred on its drawn size; where neighbours would overlap, the band uses the compact form one step earlier.

## Copy

Margin color, margin, auto, Auto, the Canvas color, Name and size on the margin, Fold the title block, Show the title block, Change Technique, Frame tools, and the line "The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it." (`writing.md`, Margin sheet copy). Everything else is existing copy: Rotate Frame, Edit Frame, Export, Remove Frame, Move Frame, Row done, Row not done, Turn row direction, Reset progress, Row highlight, Letters, Technique, by {maker}, Name this frame, Custom color.

## Acceptance

- [ ] The margin is 4 positions wide, filled with its color, with the inner border, in light, dark, high contrast and on a Custom Canvas color.
- [ ] Auto follows the Canvas color; the picker in the Frame panel and on the sheet offers Auto, the five Canvas colors and Custom color, remembered on the device.
- [ ] The top band holds Row progress, the Move bar and the tools; Row done there and in the Progress bar move the same pointer.
- [ ] The title block edits the name, the Technique and the maker's name, shows the sizes and the lettered legend, and toggles Letters.
- [ ] Rulers top, left and right; the row pointer in the left band.
- [ ] The full, compact and folded forms follow the band's height, with nothing clipped or overlapping; the fold button and tab work.
- [ ] No gutter controls remain; exports never show the sheet.

Hand-written from the ticket 0655 design canvas; static rendition.
