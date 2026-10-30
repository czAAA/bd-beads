# MarginSheet

The Frame's keep-out margin drawn as a sheet of drafting paper: its own background and inner border, the Frame's tools and Row progress in its top band, a title block in the Frame's own bottom-right corner, and the rulers on three sides (ticket 0655; design canvas "Keep-out margin variants", variant A "Drafting sheet", https://claude.ai/artifact/Aj9Tmr8xpdTfaaKBzLYzeh). It replaces the flat margin and the gutter controls of the Frame card. Built by tickets 0656 (width and color), 0657 (tools, title block, Row progress) and 0658 (zoom forms and folding).

## Width

- **4 bead positions on every side**, fixed, not a setting (was 6). The keep-out rules of the Frame card are unchanged; only the width is.
- 4 is what the content needs at 100% zoom, where a bead pitch is 18px and the band 72px. The top band holds the 10px border inset, the 28px tool row, the column numbers (12px) and 7px to the Frame line: about 64px. The bottom band holds 7px from the Frame line, the 48px title block and the 10px inset: about 65px. The side bands hold the row numbers (about 40px). Three beads (54px) cannot hold the title block; five or more is empty paper.

## The sheet

- **Fill:** the margin color (below) on the whole band, outer corners `radius-lg` (12px; 10px in the compact form). It is opaque over the Canvas and its Position marks; the Frame's own sheet sits on it as before.
- **Inner border:** 1px `margin-line`, inset `--margin-border-inset` (10px; 6px compact), radius `radius-sm`, like the border of a drawing. Nothing else is drawn on the paper: no zone letters, no crop marks.
- **Edge:** a 1px `margin-line` hairline round the outside, so the sheet reads on a Canvas of nearly the same color.
- **High contrast:** the sheet is white with a 2px black border and a 1px `margin-line` inner border.
- **Never in exports:** PNG and PDF print the Frame's beads only, as before.

## Margin color

- **Auto** (the default): the Canvas color one step off, toward white by 5% in dark and toward black by 5% in light, its hue kept: Slate `#3b3e43` gives `#45484c`, Night `#202020` gives `#2b2b2b`, Linen `#f7f3ec` gives `#ebe7e0`, Studio `#fafafa` gives `#eeeeee`. On a Custom Canvas color the step goes toward white when the Project is drawn in the dark look and toward black in the light look (CanvasBackground card). It follows the Canvas color as it changes: the Canvas layer's own Background since ticket 0666, whatever the Frame's.
- **Picked:** the standalone `BackgroundColorPicker` (CanvasBackground card, ticket 0653) with an **Auto** swatch first, then the theme's five Canvas colors, then the Palette's Custom color tile. Auto is drawn split corner to corner, the Canvas color and the margin color, so it shows what it does. The swatch equal to the current Canvas color carries a 6px dot (`ink` at 70%) and the name "{color}, the Canvas color", and its Tooltip says so: "Canvas color" («Цвет холста») over the hex, chosen or not, where every other swatch's reads "Color" (ticket 0684); picking it leaves no margin visible. The chosen one is ringed with a check as in every BackgroundColorPicker.
- **Remembered on the device**, as the Canvas color is: the position for the five, one Custom color for both themes. Not an Undo step.
- **Where:** the Frame panel's new last section, **margin** (PanelSection, after beads needed; summary "auto" or the color's name), and the **Margin color** button on the sheet, which opens the same picker in a popover under it (the shared popover look, 12px padding, `label` "margin color", the swatches, the name and hex line).
- **What sits on it:** text and icons are `ink` and `body`; the rulers take the nearest grey to the look's own `ruler` at 4.5:1 or more against the margin color, the 5th numbers at 7:1, the rule the Custom Canvas color uses.

## Top band

Left to right, 14px in from the sheet's top-left corner (10px compact), 4px apart:

1. **Row progress:** the Progress bar's controls, the same component in a compact form, tracking the same progress (ProgressBar card): Turn row direction, Reset progress, the Row highlight Switch, a 1px divider, the counter ("5/11", `control`), a 64px track, a divider, Row not done (icon only, `arrow-up`, its name and Tooltip the label it has in the bar) and **Row done** (the bar's primary button at 26px, label and trailing arrow). Pressing either moves the one pointer, in the margin and in the Progress bar alike. With no Frame there is no sheet. Its 64px track carries the Progress bar's spark at the compact size, an 8px dot with a 24px tail (ticket 0729).
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
| 1 | The Frame's **name** (Inter 600 12, one line, ellipsis; "Name this frame" in `muted` when empty) with a pencil · the **Technique** (Inter 500 12) with a pencil · one cell per **setting** the Technique describes, its value in short ("2-drop") with a pencil (ticket 0698) · "by" (`meta-small`) and the **maker's name** (Inter 500 12) with a pencil, over two cells · the **fold** button over both rows |
| 2 | The size in beads ("40 × 11", `meta-small`) · the estimated size ("≈ 6.4 × 1.4 cm") · the **legend**: one 14px disc per Palette color in the Frame, holding its Swatch letter (white on dark beads, `ink` on light, Inter 600 8), under the settings and the maker's first cell · **Letters** and its Switch |

- The pencils are 18px buttons with 12px icons: the name edits in place as in the Frame panel (Save, Cancel, "n/40"); the Technique opens the Project's Technique PanelPicker as a popover, locked with its reason once a row is done; the maker's name is the Project's Name on exports (NameOnExports card), so a change shows in Project and on every export.
- The legend shows at most 8 discs, then "+n". Letters is the Frame panel's Letters setting (saved with the Project): on, the Frame's beads carry their letters, as the PNG and PDF do, each upright on screen however the Canvas, the Frame or the bead is turned (ticket 0728).
- **Name and size on the margin**, a Switch in the Frame panel's margin section (on by default, remembered on the device), hides the title block; the fold tab then is not shown either.
- The title block is the only place the canvas shows the Frame's name: it is not drawn under the Frame (ticket 0719); an unframed named Piece's name hangs on its own tag (SchemaTag card, ticket 0721).
- **Fold** (`chevron-down`) folds the title block to a tab in the same corner: the name (Inter 600 11) and `chevron-up`, 24px tall, `margin-title` fill. The tab unfolds it. Kept for the session.
- **On a turned Canvas** (ticket 0728) the title block stays on the Frame's own bottom-right corner, the one that is bottom-right when the Canvas is upright: bottom-left on screen after Rotate canvas to 90°, top-left at 180°, top-right at 270°. It is drawn upright on screen inside the inner border there, and its forms, the tab and giving way to a Selection's handles work there as at the bottom-right. At a top corner it shares the top edge with the band's row: the block takes the corner and the row is laid out in the width left beside it, stepping down as on a narrow sheet; the block leaves the narrowest row (the Move bar and the Frame tools button) its room, so the Frame can always be moved. During a two-finger twist it stays on that corner, its contents leaning with the Canvas by less than 45° and snapping upright on the next quarter turn past 45°. The top band itself stays along the screen's top edge. A Frame turned with Rotate Frame does not move it: the corner is taken from the Frame as it lies on the upright Canvas.

## Rulers and the current pass

- With a Frame, its rulers are drawn on three sides, none along the screen edge the title block is on: the bottom, or the top on a Canvas turned 180° or 270° (ticket 0728). Placement, sizes and the 5th-number rule are the Rulers card's; their color follows Margin color above.
- The **current pass** is marked on its own ruler number: a `marker` pill behind it, 2px round the number and fully rounded, the number weight 700 in `canvas` (Rulers card), in both bands that number it (left and right for a row; the top for a column once Turn row direction sets columns). The numbers sit below the tool row in every form, so the mark never meets a tool. The pass itself keeps its ring and the finished passes their dimming (BeadBoard card).
- **Row done (ticket 0729):** the pill glides from the pass's number to the next one's over `duration-base` with `ease-standard`, in every band that numbers it, the two numbers crossfading their color; the tick glides along the Frame's line the same way. When the last pass is done the pill and the tick fade out over 150ms (`ease-in`) and Pattern done plays over the Frame, inside the sheet (Motion section, Row progress). Under reduced motion they jump.
- Where the pass has no number drawn (the compact and folded forms, Rulers off, a Frame turned a quarter, whose numbers count the cells it covers, or a Ruler step that skips it), the mark is a **tick**: 3px thick in `marker`, rounded, from the middle of the Frame's line in to the beads, at the pass; on the left and right sides for a pass across the screen, on the top for one down it. Inside the line, it never stands under a tool.
- None for a Custom frame, whose passes are no line, nor once every pass is done, nor in the bare form (ticket 0685; it replaced a 9 × 12 `marker` triangle 4px outside the numbers, which with columns could sit under a tool).

## Zoom forms

The sheet is drawn at a **scale**, the band's height over the drafting sheet's 72px, held between **0.6 and 1.5** (ticket 0698): every px on this card (tools, Row progress, the Move bar, the title block, the insets, the inner border, the corners and the Frame's ruler numbers) is multiplied by it, so the sheet keeps the proportions drawn here and grows and shrinks with the beads instead of jumping between sizes. Only under the smallest scale, where the controls shrink no further, does it change form, by the band's height at scale 1 (a loom bead is 20px at 100%, so the band is 80px there, scale 1.11):

- **Full** (band 0.6 × 68px and up, about 51% and closer): as above, at the scale.
- **Compact** (0.6 × 40 to 0.6 × 68px, about 30% to 51%): tools 24px with 14px icons, 2px apart; Row progress shows Row highlight, the counter, a 40px track and Row done (22px); the title block is one 22px row (name, Technique, its settings, size in beads, size in cm, the legend, Letters, fold); no ruler numbers, only the Frame line; the inner border inset 6px, the corners 10px; the row 8px down and 10px in; all at 0.6.
- **Folded** (0.6 × 31 to 0.6 × 40px, about 23% to 30%): the Move bar, Row highlight and the counter with Row done, the Margin color button and a **···** button ("Frame tools") whose menu holds Rotate Frame, Edit Frame, Export and Remove Frame; the title block is the name tab. The paper keeps its color and edge, with no inner border; the row and the tab stand in the middle of the room between the sheet's edge and the Frame's line. Folding by hand (the title block's fold button) folds the title block alone; the tools stay.
- **Bare** (under 0.6 × 31px, under about 23%): only the **Move bar**, at its own size (56 × 24), not scaled. Not even the folded row fits between the sheet's edge and the Frame's line, so nothing of the sheet is drawn: no paper, edge or inner border, no title block, tab or legend, no buttons, no ruler numbers and no mark of the current pass. The Move bar (56 × 24) stands alone above the middle of the Frame's top edge, its bottom on the Frame's line, so the Frame can be dragged at any zoom; it may stand outside where the sheet would be, and never over the Frame's line or beads. The 4 positions are still kept clear for drawing and Selection, and a refused press still flashes the dashed outline. The Frame panel, the Progress bar and the Canvas strip still have the other tools.

## Touch

On a coarse pointer every control on the sheet has a 44px hit area, centred on its drawn size; where neighbours would overlap, the band uses the compact form one step earlier. Bare, the Move bar rises by the part of its hit area below it and 16px more, so a finger on the Frame's first row reaches the bead.

## Copy

Margin color, margin, auto, Auto, the Canvas color, Name and size on the margin, Fold the title block, Show the title block, Change Technique, Frame tools, and the line "The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it." (`writing.md`, Margin sheet copy). Everything else is existing copy: Rotate Frame, Edit Frame, Export, Remove Frame, Move Frame, Row done, Row not done, Turn row direction, Reset progress, Row highlight, Letters, Technique, by {maker}, Name this frame, Custom color.

## As built (ticket 0657)

- **Values:** the top band's inset `--margin-band-inset` (14px), the Move bar's hit height `--margin-move-height` (28px; 56 wide, as `--frame-handle-hit-width`), Row done `--margin-done` (26px), the track `--margin-track` (64px), a title block pencil `--margin-pencil` (18px), a legend disc `--margin-legend-disc` (14px), the name `--margin-title-name` (Inter 600 12), a disc's letter `--margin-legend-letter` (Inter 600 8) and the name editor `--margin-edit-width` (260px), in `bundle.css` and `src/styles/design-values.css`.
- **The band's row** is three columns: Row progress at the start, the Move bar centred, the tools at the end. A sheet too narrow for it steps down a form (ticket 0658, As built below). On a phone the full form only shows zoomed in, where the canvas is panned to reach the rest.
- **Editing in place:** the name and the maker's name open their field (Save, Cancel, "n/40") floated above their cell in the shared popover look, since a 23px cell cannot hold it; Escape or Cancel closes it; a press outside closes it too and keeps what was typed, as Save does (ticket 0685), and Undo takes it back. The Technique pencil opens the PanelPicker's menu under it.
- **The legend** follows the Palette's order (A, B, C…), not the bead count; a color with no letter shows "?", as the Word chart does. The name's cell stops at `--margin-edit-width` and ellipsizes.
- **Hot corners** are drawn just outside the Frame line, as in the design canvas: a bracket's stroke 3px clear of it, an edge's bar against it; their hit points are on the line.
- **Touch:** every control on the sheet is a `ui-control`, whose coarse-pointer hit area is 44px (controls.css). Edit Frame keeps the Frame card's four corner handles on touch.
- **Gives way:** the band's row and the title block take no press where a Selection's handles reach under them (ticket 498). The Tool pill, its color popover and the Selection bar are drawn over the sheet and take their own presses (ticket 0698).
- **Mirror's Select area (MirrorPopover card, ticket 0710):** while an Area is being picked the sheet is a target for the whole Frame: under the pointer its paper tints `marker` at 10%, its outer edge turns a solid 1.5px `marker` line (radius 12) and a dashed (4 3) `marker` preview rectangle shows round the Frame, over `duration-fast` (none under reduced motion); a press, taken on release, makes the whole Frame the Area. The sheet's own controls take no press meanwhile.
- **Edit Frame's outline** is the sheet element's own outline (DOM), the hot corners and size Tooltip are drawn on the canvas; the Tooltip sits out from the hot corner, beyond its disc.

## As built (ticket 0658)

- **Breakpoints** (Zoom forms above), checked in the browser at every 5% from 30% to 150% on Frames 40, 16, 8 and 3 beads wide, in English and the longest text of every language (`MarginSheet.browser.test.ts`): nothing of the Frame stands outside its sheet, over its line or beads, or over another control. They are the band's height, `--margin-band-full` (68px), `--margin-band-compact` (40px) and `--margin-band-folded` (31px); the canvas draws the sheet and the rulers by the same rule (`src/rendering/marginForm.ts`).
- **Why 68 and 40, not 64 and 34:** the Frame's line stands 5 to 7px out from the beads, inside the band. The full title block (10px in, 48px) needs 68px to stay clear of it; the compact row 40px.
- **Too narrow:** where the sheet's width cannot hold a form's row, the row steps down: full, compact, folded, then folded with Margin color in the Frame tools menu and no Row progress, then none. The title block steps down full, compact, the tab. Each form's width is measured as it is shown.
- **The fold** is kept for the session (not saved) and applies to every Frame. The fold button is in the compact title block too, its last cell. The tab is a button (chevron-up, "Show the title block: {name}") only where the sheet has room to unfold the block; folded by the zoom or the width, it is the name alone.
- **The Frame tools menu** opens Export hung from the ··· button. Its items are the band's buttons' own actions, names and disabled reasons.
- **Compact title block:** the name and the Technique are read only there (no pencils); the full form and the Frame panel edit them.
- **Left out:** the coarse-pointer rule (Touch above: the compact form one step earlier where 44px hit areas would overlap) is not built. (A row pointer that could sit under a tool with columns running was replaced by the mark on the number, ticket 0685.)

## As built (ticket 0698)

- **Why a scale:** the 4-bead band is 72px only where a bead is 18px; a default bead is 20px at 100% and grows with the zoom, so controls of a fixed size floated in an empty band zoomed in and jumped a form (28px tools to 24, two rows to one) as the zoom passed 68 and 40px of band. The rule is `marginScale` in `src/rendering/marginForm.ts`, the same for the canvas that draws the sheet, the rulers and the controls laid over it.
- **How:** the band's row and the title block are laid out in the drafting sheet's px and drawn with a CSS `scale` from the corner they are anchored to; each form's width is measured in those px, so a learnt width holds at every scale. The Frame's ruler numbers take the scale in place of the zoom's own rule (11px × scale), and so does the current pass's pill; the Frame's line, the tick and the hot corners are the Frame's and keep their own rule.
- **Too narrow, again:** each tools form first gives up Row progress's track, then its counter, so Row highlight and Row done stay to the last; then the next form. The title block gives up the legend first (the compact row without it), then is the tab.
- **Popovers and menus** on the sheet (Margin color, a setting's stepper, the name and maker editors, the Technique picker, Frame tools) open in the top layer, so the scale never shrinks or moves them, and follow their button as the canvas is panned, zoomed or turned. Margin color closes where the zoom or the width takes its button away. The name and maker editors open 4px above their cell (they were 8px above, 8px to the left).
- **A setting's cell** comes from the Technique's description (`describeWeave(...).settings`), never from its name: its value through the setting's `short` words ("{count}-drop"), its pencil named "Change {setting}" with the setting's Tooltip, and the panels' stepper in its popover, each step applied at once. Locked with the Technique once a pass is done, with the setting's own reason. Read only in the compact row.
- **Checked against the drafting sheet artboard** at 200%, 100%, 60%, 40% and 20% (loom, peyote, and brick stitch with Drop 2): the band's order, the tools, the Move bar, the title block's cells and rules, the fold button, the legend and the insets match it at scale 1. What differed was the proportion (controls of a fixed size in a band of 80 to 160px, and on a narrow sheet the tools and title block spilling past its edge, the fold button off it) and the Technique pencil standing about 2px above the others (its picker's wrap sat on a text baseline); both are gone.
- **Touch:** the 44px hit areas scale with the sheet too (26px at 0.6); the coarse-pointer rule (compact one step earlier) is still not built.
- **Stacking:** the sheet is part of the drawing and takes no z-index (StackingOrder card: nothing in the canvas box goes above `z-canvas-overlay`). At its scale the title block reached under the Tool pill and was drawn over the pill and its color popover, while taking no press there itself; now they float over it, and the parts of the band and title block the pill does not cover keep taking their presses.

## As built (ticket 0682)

- **Bare** is the fourth form of `src/rendering/marginForm.ts`; the canvas leaves the sheet out, the rulers leave out the current pass's mark (and, as in the compact and folded forms, the numbers), and the sheet's controls are the Move bar alone (`MarginMoveBar.vue`, the same control as in the band). The Frame's line, its hot corners while Edit Frame is on, and the size Tooltip are the Frame's own and stay; the sheet's Edit Frame outline goes with the sheet.
- **Touch:** a browser moves a finger's press to a control up to about 16px away from it (touch adjustment), and a canvas is not such a control, so on a coarse pointer the bar stands its 44px hit area and 16px more above the Frame's line: about 29px from the line to its drawn bottom.
- **Gives way** to a Selection's handles, as the band's row does, and lies under the Tool pill.
- **Checked** in the browser (`MarginSheet.browser.test.ts`: at 10%, 25% and 38% on Frames 40 and 3 beads wide, the bar takes its press and a press on the first row lands on the canvas) and in the app (`e2e/visual/frameControls.spec.ts`: at 10%, 20% and 30%, by mouse and by touch, the bar drags the Frame and the first row paints).

## Acceptance

- [ ] The margin is 4 positions wide, filled with its color, with the inner border, in light, dark, high contrast and on a Custom Canvas color.
- [ ] Auto follows the Canvas color; the picker in the Frame panel and on the sheet offers Auto, the five Canvas colors and Custom color, remembered on the device.
- [ ] The top band holds Row progress, the Move bar and the tools; Row done there and in the Progress bar move the same pointer.
- [ ] The title block edits the name, the Technique and the maker's name, shows the sizes and the lettered legend, and toggles Letters.
- [ ] Rulers top, left and right; the current pass marked on its number, or by a tick on the Frame's line where it has none.
- [ ] The full, compact and folded forms follow the band's height, with nothing clipped or overlapping; the fold button and tab work.
- [ ] No gutter controls remain; exports never show the sheet.

Hand-written from the ticket 0655 design canvas; static rendition.
