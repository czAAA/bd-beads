# ReferenceImage

One picture per Project, laid on the Canvas so the person can bead over it (tracing) or keep it beside the pattern as an example to copy from. Shown and hidden from the Canvas strip, set up in the Project panel's **reference image** section, resized and turned from its handles whenever it is shown, moved, framed and converted to beads from its **picture bar**, and moved by keys in **Adjust**. Saved with the Project. Built by ticket 0790, its handles outside Adjust and Replace on the Adjust bar by ticket 0799 (the picture, the strip button, the section and Adjust; ADR 0089 for where the picture is kept); mockups link on ticket 0790 in the private docs repo. The picture bar, Set Frame around the picture and Convert to beads are ticket 0883; mockups link on ticket 0883 in the private docs repo (desktop, light; the phone follows the rules below until it is designed).

The word is **Reference image** everywhere (glossary, Canvas and Frame). Not "background image": **Background** is a layer's color (CanvasBackground card).

## On the canvas

- **Where it is drawn:** over every layer's Background (the Canvas's and the Frame's, a Custom frame's Off-shape included) and under every bead, every layer's. The rulers, the margin sheet, the Frame line and its gutter controls are drawn over it. It is in Canvas coordinates: it pans and zooms with the beads and turns with Rotate Canvas (its own turn adds to the Canvas's).
- **Opacity:** four steps, 25%, 50% (a new picture's), 75% and 100%, stored as the step. No slider.
- **Painted beads** cover it as they are. **Empty beads** become see-through so the picture reads between them: their fill (the background's empty bead) drawn at 50% under the 25% step, 37% under 50%, 25% under 75% and 12% under 100%, always with the `bead-rim`, so the grid stays readable. With the picture hidden, empty beads are drawn as before. On the Canvas outside the Frame the empty positions are the Position marks, outlines with no fill, drawn over the picture as they are; the steps are the Frame's empty beads', in the full look and the draft look at small zoom alike.
- **Two uses, no mode:** over the bead area at 25 or 50% it is a tracing guide; moved beside the pattern at 100% it is an example to copy from. Nothing covers it outside the bead area.
- **A new picture** is fitted inside the Canvas's beads (the box round them; a new Canvas's whole grid), centred, turn 0°, and lands in Adjust when it was picked from the strip button.
- **Never printed:** PNG, PDF, the Projects library thumbnail and the Homepage examples leave it out.
- **High contrast:** shown as in light; the empty-bead fill follows the same steps on the white canvas.
- Every tool works over it as usual. Outside Adjust only its handles and its picture bar can grab it (below), so a stroke, a Fill or a Selection over the picture never moves it.

## Handles while shown (ticket 0799)

Whenever the picture is shown and the editor is in view, its four corner handles and its Turn handle stand on it, as Adjust draws them (below), so the person resizes and turns it at any time, whatever tool is in hand. A drag on one works as in Adjust (shape kept, opposite corner put; snapping, Shift, the angle chip) and is saved on release, no Undo step, announced as in Adjust. Outside Adjust:

- no outline round the picture, so no line sits over the beads being traced;
- the picture itself takes no press: a press on it is the tool's; moving it is the picture bar's Move grip (ticket 0883), and Fit to Canvas stays Adjust's;
- no Tab stop, no Escape and no press outside to end anything; the handles are buttons named as in Adjust;
- hidden with the picture, and while Convert image fills the drawing area.

Where a handle lies over the Frame's own resize handle (Edit Frame on, the picture's corner on the Frame's), the picture's handle takes the press.

- **Corners only** (ticket 0883): the four corner handles keep the picture's shape; there are no edge bars, since stretching one side would spoil the tracing.
- **The size while resizing** (ticket 0883): while a corner is dragged, a Tooltip-look chip beside it (the angle chip's look) gives the beads the picture covers and their measure through the Bead, "28×19 beads" in `small` over "≈ 4.2 × 2.9 cm · shape kept" in `meta-small` `muted`, live. This is the size Convert to beads makes, so the person sets it here. The picture bar and the Turn handle hide while a handle is dragged.
- **The Turn handle stands below the picture** (ticket 0883): Adjust's handle, on its dashed stem from the bottom edge's middle, so the top edge is free for the picture bar; above the top edge, the bar then going below, only when there is no room below in the canvas box.

## Picture bar (ticket 0883)

A small pill that stands over the picture's top edge whenever the picture is shown, so the picture's own actions are on the picture, not in a panel. The Tool pill's look: `canvas` fill, 1px `box-line`, `radius-full`, `elevation-3` (in dark a 1px `line-strong` edge), 40 tall with 3 4 padding and 2 between its items, centred on the top edge's middle, its bottom 14px above the edge. It stays level when the picture is turned (it follows the picture's place, not its angle), is drawn in screen pixels like the handles so it keeps its size at every zoom, and is kept inside the canvas box.

- **Its items**, left to right: the **Move grip**, a divider, **Set Frame around the picture** (`frame`), **Convert to beads** (`convert-to-beads`), a divider, and **···** (`more`, named "More for the picture"). The buttons are round 32px icon buttons (hover `ink` at 8%, pressed `ink` fill with a `canvas` icon); dividers are 1 × 18 `line` with 4 either side.
- **Move grip:** the Frame's Move bar (MarginSheet card) at the bar's size, a 32 × 6 `ink` pill in a 52 × 32 hit area, cursor `grab` / `grabbing`. Dragging it moves the picture, which travels under it on screen; saved on release, no Undo step, announced "Moved", as Adjust's drag. A button named "Move the picture" with the Tooltip "Drag to move the reference image."; while it has focus, arrows move the picture one bead the way they point on screen, Shift ten, as in Adjust. So moving no longer needs Adjust.
- **··· opens the rest in place:** the bar grows to the right of Convert to beads (its centre staying on the edge's middle) with a divider, **Opacity** as a small SegmentedControl (`picker-height`, 2px inset on `surface` with a 1px `line`, the steps 25%, 50%, 75%, 100% in `meta-small`, the chosen one `ink` with `canvas` text; arrows move and apply; named "Opacity"), a divider, **Replace** (`image`, a 32 tall text button in `tab` type) and **Remove** (`delete`, `danger` text, its hover `danger` at 10%; it asks as the Project panel's Remove image does, ConfirmDialogs card). ··· is then pressed and shows `close`, named "Close"; it, Escape while the bar has focus, or a press on the canvas folds the part away again. Replace and Remove are the Project panel's own actions (one action, many triggers): Replace keeps the place, the turn and the width.
- **Keyboard:** the bar is a `toolbar` named "Reference image" and one Tab stop, its items reached by ←/→, Home and End (the one last focused is the stop), as the margin sheet's band is. The handles stay out of the Tab order.
- **Tooltips:** every button has one, from the control registry where an action exists. Set Frame around the picture and Convert to beads carry a name and a body (below).
- **With a Frame:** where the picture lies under the Frame's margin sheet, the bar stands 14px above the sheet's top edge and the Turn handle below the sheet's bottom edge, so neither covers the sheet's band, title block or the Frame's tools. A Selection's handles and the Frame's Move bar win a press where they overlap the bar.
- **Hidden** with the picture, while a handle is dragged, in Adjust (the Adjust bar is there), and while Convert image fills the drawing area.
- **On a coarse pointer** its buttons and the grip are 44px (`touch-target`) and the bar 52 tall; where the opened part does not fit the canvas box's width it wraps under the bar as a second pill. The phone is to be designed.

## Set Frame around the picture (ticket 0883)

- **The button:** the bar's `frame` icon. Tooltip name "Set Frame around the picture", body "A {size} Frame where the picture lies. Replaces the Frame you have." ("A 26×18 Frame where the picture lies." while there is no Frame).
- **Hover or focus previews the Frame it makes,** in `accent-strong`: the Frame's line (2px, 6px corners) round the beads the picture covers, the margin sheet's outline as a 1.5px dashed `accent-strong` edge filled with `accent` at 7%, and a tag at the sheet's top-left: a `canvas` pill with the `frame` icon and "new Frame · 26×18" in `meta-small`. Nothing else moves.
- **A press sets the Frame** to the smallest Frame holding every Canvas position whose centre lies on the picture (the box round a turned picture), in the Frame's Technique and Bead, or the Canvas's when there is none: Add Frame with no Frame, Replace Frame with one, with their flow, their one Undo step and their confirmations. Once a Row progress pass is done the button is off, its Tooltip giving Replace Frame's reason. A Custom frame is replaced by a rectangular one. The picture does not move; its bar steps above the new sheet.

## Convert to beads (ticket 0883)

- **The button:** the bar's `convert-to-beads` icon (a picture, an arrow, four beads). Tooltip name "Convert to beads", body "Turns the picture into {size} beads, the size it has on the Canvas, in its own colors." ("26×18"). Pressed while its popover is open.
- **The popover** stands beside the picture, 20px right of its right edge (left of the left edge when there is no room), its top level with the bar's, so the picture's place stays in view: 360 wide, `canvas` fill, 1px `box-line`, `radius-lg`, `elevation-3`, padded 16 20 18, 14 between its parts. A non-modal `dialog` named "Convert to beads"; focus goes to its first control, and Escape or the close × gives focus back to the button.
  1. **Title** "Convert to beads" in `title`, with the close × (28px icon button).
  2. **size:** the `label` "size", "26×18 beads" in `meta` at 500 `ink`, "≈ 3.9 × 2.7 cm" in `meta` `muted`, and an Info button ("Where the size comes from"; Tooltip "The picture's size on the Canvas. Drag a corner of the picture to change it."). The size is the Canvas positions whose centres lie on the picture, the box round them giving columns × rows; the measure is through the Canvas's Bead.
  3. **match to:** the `label`, then a SegmentedControl across the popover (34 tall, its options sharing the row by their text): **Exact** (the default) | "{Bead} palette" (only with a Color catalog, named as Convert image names it) | Default Palette; under it one `small` `muted` line, Convert image's own Note for the choice ("Keeps the picture's own colors. These are not beads from a shop." under Exact).
  4. **Colors:** "Colors" in `control`, the count in `meta` ("14 of 14"), and a joined − | + Stepper (`picker-height`, Stepper card), from 1 to every color the picture's beads sample, at most 256, starting at the most; under it a swatch per color, 18px, `radius-sm`, the `swatch-edge` inset, wrapping.
  5. **Hide the picture after**, a Switch row under a 1px `panel-rule`, on by default.
  6. **All settings** (secondary, trailing `arrow-right`) at the left and the primary **Convert {n} beads** (leading `convert-to-beads`) at the right. All settings closes the popover and opens Convert image with this picture, this size, Exact and this color count already set, ending in **Add to Canvas** instead of Create Project (ConvertImage card).
  - With beads already on the picture's positions, a `small` line over the buttons: "Replaces {n} beads already there."
- **Live preview while it is open:** the picture is drawn as the beads it will make, in its place, by the Project renderer at the Canvas's Bead (the picture itself hidden), with a 1.5px dashed `ink` line round them on 6px corners and a `canvas` pill "preview" in `meta-small` `muted` inside its bottom-left corner. Every change redraws it. The handles stay: a corner drag updates the size, the preview and the popover live.
- **Convert** puts the beads on the Canvas at those positions, each the color matched there (none where the picture is transparent), replacing what was on them: one Undo step, "Convert to beads". With Hide the picture after on, the picture is then hidden (the strip button unpressed), which is not an Undo step, like every view change. A turned picture is converted as it lies: the positions whose centres fall on it.
- **Then a toast** (Message card, success, top-right of the canvas box): "{n} beads made from the picture, {colors} colors.", followed when it was hidden by "The picture is hidden: show it from the Canvas strip.", with the text action **Undo**, which undoes the conversion and shows the picture again. It goes after 5s like other toasts.
- **Off** (`aria-disabled`, its Tooltip saying why) while the picture covers fewer than 4 positions a side ("The picture is too small to bead. Make it bigger first.") or more than 300 ("Too big to convert here. Use Convert image.", the Large Schema limit).

## As built (ticket 0883)

Where the build differs from the sections above, and why:

- **The bar with no room above:** where neither the picture's top edge nor its margin sheet leaves room for the bar above them, it stands 14px inside the picture's top edge as it shows, over the picture, not below it: below are the Turn handle and the Tool pill.
- **Keyboard:** ←/→, Home and End move along the bar's buttons; while the Move grip has focus its arrows move the picture instead (Home and End still leave it). The opened part's Opacity control keeps its own Tab stop, as a SegmentedControl's arrows choose its step.
- **Set Frame around the picture** makes the Frame as Frame from Selection does: the Canvas's beads inside the box move into it, and a Frame already there lays its beads back on the Canvas first, so no bead is lost and nothing is asked. A Custom frame is taken off as Remove Frame takes it (its beads on the Canvas) and the rectangular Frame made, one Undo step. The preview shows the Frame and sheet that press makes.
- **Convert to beads under a Frame:** positions under a Frame woven and beaded as the Canvas, without a Frame shape, get their beads on the Frame in its own positions; under any other Frame they get none, as it hides the Canvas there and has no positions to match. Where the picture lets the Canvas through, a bead already there stays.
- **The measure** in the size chip and the popover is the app's estimate ("≈ 4.2 × 2.9 cm", in mm under a centimetre); the Colors stepper's buttons are named "One color fewer" and "One color more".
- **The match to control's options** share the row by their text and keep to one line; a long Bead's palette takes a row of its own.
- **Set Frame around the picture's Frame** starts on a row (and column) where a Frame may start in the Canvas's Technique, as Frame from Selection's does, so on alternating rows it can be a row taller than the box the picture covers; the Tooltip's size, the preview and its tag show that Frame.
- **All settings** opens Convert image, whose own limits apply: at least 8 beads a side. Convert image has no turn of its own, so it converts the picture upright at the size the turned picture covers; the bar's own Convert to beads takes it as it lies.

## Canvas strip button

- The `reference-image` icon (the `image` picture with a dashed edge), plain look, right after the Rulers toggle, before Undo (CanvasStrip card). Name "Reference image". Shown only with a Project open; at every width, scrolling with the tools on a phone.
- **No picture yet:** not a toggle (no `aria-pressed`). A press opens the file picker (the Convert image picker's formats); a picked picture is fitted and opens in Adjust. Tooltip "Add a reference image", with no key chip: `I` only shows and hides a picture. A file the picker refuses opens the Project panel on the reference image section, with the refusal line there (below), so every refusal reads in one place.
- **With a picture:** a toggle, `aria-pressed`, the Rulers look (pressed: `ink` fill, `canvas` icon). Tooltip "Hide reference image" while shown, "Show reference image" while hidden, with the key chip `I` (control registry).
- Shown or hidden is saved with the Project; a new picture is shown.

## Project panel section

A PanelSection **reference image** between canvas and export (ProjectPanel card), built from the MenuPanel card's shared parts.

- **Header:** the `label` "reference image", an Info button (`info`, 16px, ButtonCard's Info button) and the chevron. Folded summary in `meta`: "50% · shown", "50% · hidden", or nothing with no picture. The Info Tooltip: "PNG, JPEG, GIF or WebP, up to 10 MB. Kept with this Project and in its .openbeads file, never printed. Large pictures are made smaller to fit." (the numbers filled from the Convert image limits).
- **No picture:** one PanelItem, `image` icon, "Add reference image"; it opens the file picker and, on a pick, puts the panel away and opens Adjust.
- **With a picture**, in this order:
  1. A PanelListRow (no trailing facts): the 28px thumbnail (the picture cropped square, on `board`), the file name (one line, ellipsis) over "2048 × 1536 · 412 KB" (the stored picture, its size in whole KB) in `small` / `muted`. Not a button: the row's `still` form, with no hover.
  2. **Opacity:** a row with the label in `body` and, at its right, a four-choice SegmentedControl in the PanelPicker's height (`picker-height`), the values in `pill` type: 25%, 50%, 75%, 100%. Arrows move and apply at once. Named "Opacity", each choice "50%".
  3. **Adjust on Canvas** (`size` icon, value "move · resize · turn" in `meta`): puts the panel away and opens Adjust (below). While the picture is hidden it shows it first, so Adjust never handles an unseen picture.
  4. **Replace image** (`image`): the file picker; the new picture keeps the place, the turn and the width, its height following its own shape.
  5. **Remove image** (`delete`, `danger`): asks "Remove the reference image?", "The picture is taken off this Project. Your beads stay as they are.", Cancel and a `danger`-filled "Remove" (ConfirmDialogs card). Not an Undo step.
- Show and hide is not repeated here: it is the strip button (MenuPanel card: nothing repeats a tool).
- A refused file keeps the panel open and shows a `danger` line under the section's first row, in `small`: "This file can't be used: {reason}", one short reason per refusal Convert image makes: "not a picture", "over 10 MB", "over 16 megapixels", "it couldn't be read", "browsers can't read HEIC pictures", "SVG pictures can't be used".
- While the picture is read and made smaller, the section's first row shows the Loading card's inline spinner and "Preparing the picture…".

## Adjust

A state of the canvas, not a mode of a tool: the tools rest, pinch, two-finger pan and the scroll wheel still move the view. The picture's outline and handles are drawn in screen pixels, like the Frame's (Frame card: Gutter, resize handles, Move handle), so they keep their size at every zoom.

- **Outline:** 1.5px `ink` round the picture, turned with it.
- **Move:** drag anywhere inside the picture. Cursor `grab`, `grabbing` while dragged.
- **Resize:** four corner handles, the Handle card's in `ink` on the picture's corners and turned with it, with its reach (14px, a 44px touch area on a coarse pointer). The picture keeps its shape and the opposite corner stays put. Diagonal resize cursors, turned with the picture. No smaller than 4 beads across; no larger than ten times the Canvas's box.
- **Turn:** one handle, a 28px circle (1.5px `ink`, canvas fill, a 12px turning arrow inside; `accent` fill while dragged) on a 1.5px dashed `ink` stem, `--frame-control-offset` (48px) below the bottom edge's middle (ticket 0883; it stood above the top edge, where the picture bar now is), turned with the picture; above the top edge when there is no room below, kept inside the canvas box. Free turn, snapping to 0°, 90°, 180° and 270° within 4°; Shift snaps to every 15°. While dragged, a Tooltip-look chip beside it shows the angle in DM Mono ("12°").
- **Adjust bar:** a pill on `canvas`, 1px `box-line`, `elevation-3`, centred 14px above the drawing area's bottom (over the Tool pill's place: the pill hides while adjusting): the `label` "reference image", **Replace image** (`image`, secondary; ticket 0799), **Fit to Canvas** (`reset`, secondary) and **Done** (`check`, primary). On a phone the label goes, Replace image is a round 44px icon button (`image`, named "Replace image", with its Tooltip) and the others read "Fit" and "Done", 44px tall. Replace image is the Project panel's pick: the new picture keeps the place, the turn and the width, and Adjust stays on; a file it refuses ends Adjust and opens the Project panel on the reason, as a refusal from the strip button does.
- **Ends** on Done, Escape, or a press outside the picture and its handles (that press only ends it). Fit to Canvas puts the picture back to the new picture's fit, turn 0°, and stays in Adjust.
- **Keyboard:** the picture is focused when Adjust opens; arrows move it one bead the way they point on screen (Shift: ten), `+` and `−` resize it by a tenth, `[` and `]` turn it 15°. The handles take no Tab stop (the keys do what they do); Tab moves on toward Fit to Canvas and Done. The app's own shortcuts wait while Adjust is on, as under any overlay.
- **Screen readers:** the picture is a `group` named "Reference image, 50%, turned 12°", the handles buttons named "Resize from the top-left corner" (and the other three) and "Turn"; each change is announced politely: "Moved", "Resized", "Turned 15°". Adjust stands beside the drawing, not in it, as the drawing is one image to a screen reader.
- **Pinch and pan:** a second finger on the picture gives its drag up (the picture goes back) and pinches the view; a drag beside the picture moves the view, as the Hand tool does.
- **A view, like Background:** shown or hidden, opacity, place, size and turn are saved with the Project and are not Undo steps; Row progress never holds them.
- **Reduced motion:** nothing animates in Adjust; the bar fades in and out.

## Limits and saving

- **Picked:** the Convert image formats and caps (PNG, JPEG, GIF's first frame, WebP; at most 10 MB and 16 megapixels). A file of a library of pictures is read up to 100 MB (ADR 0089).
- **Stored made smaller:** at most 2048 px on its longest side, WebP where the browser encodes it, else JPEG (PNG when it has transparency), stepped down until it is at most 1 MB. The row's size line shows what is stored.
- **Where:** the picture's bytes beside the Project library on the device, the settings with the Project, and both inside the `.openbeads` file (ADR 0089, ticket 0790). Duplicate copies it; Delete and Delete all remove it.
- **Not saved:** a device that refuses to keep it (a private window can) shows the picture for the session, and the Project panel's local save icon says "Reference image not saved on this device".

## Copy

English: Reference image, Add a reference image., Show reference image., Hide reference image. (the Tooltip bodies), reference image (section label), {opacity}% · {state}, Add reference image, {width} × {height} · {size}, {count} KB, Opacity, {count}%, Adjust on Canvas, move · resize · turn, Replace image, Remove image, Remove the reference image?, The picture is taken off this Project. Your beads stay as they are., Remove, Cancel, This file can't be used: {reason} and its six reasons (above), Preparing the picture…, Fit to Canvas, Fit, Done, shown, hidden, Reference image, {opacity}%, turned {angle}°, Resize from the top-left corner (and the other three), Turn, Turned {n}°, Moved, Resized, Reference image not saved on this device. Every language is in `writing.md` (Reference image copy).

The picture bar, Set Frame around the picture and Convert to beads (ticket 0883), English: Move the picture, Drag to move the reference image., More for the picture, Close, Replace, Remove, Set Frame around the picture, A {size} Frame where the picture lies. Replaces the Frame you have., A {size} Frame where the picture lies., new Frame · {size}, {size} beads, ≈ {width} × {height} cm · shape kept, Convert to beads, Turns the picture into {size} beads, the size it has on the Canvas, in its own colors., size, Where the size comes from, The picture's size on the Canvas. Drag a corner of the picture to change it., match to, Colors, {count} of {max}, Hide the picture after, All settings, Convert {n} beads, Replaces {n} beads already there., preview, Preview: {size} beads, {colors} colors, {n} beads made from the picture, {colors} colors., The picture is hidden: show it from the Canvas strip., Undo, The picture is too small to bead. Make it bigger first., Too big to convert here. Use Convert image., Add to Canvas. Every language is in `writing.md` (Reference image copy, ticket 0883).

Hand-written from the ticket 0790 mockups and the ticket 0883 design canvas; static rendition.
