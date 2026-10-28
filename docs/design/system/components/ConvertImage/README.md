# ConvertImage

The Convert image wizard: one large popup where a picture becomes a new Project, a live bead preview beside five numbered sections, every change shown at once (spec 0645, ADR 0010). It replaces the size dialog (ticket 342) and the framing step in the canvas box (ticket 58). Designed in ticket 0646 (design canvas https://claude.ai/artifact/STCJ6XW9qBXTDJZUEHvJuD); the build tickets split from spec 0645 build it, and until then the app keeps the size dialog and the canvas-box framing.

## Frame

- **From 1024 px wide in landscape:** a Modal of the large size (Modal card): `modal-large-width` × `modal-large-height` (1200 × 820), never more than the viewport less 24 on each side, centred over the scrim. Header 56: "Convert image" in `title`, the Close icon button. Body: the preview pane on the left, taking the rest; the sections pane on the right, `convert-sections-width` (440; `--convert-sections-width-narrow`, 400, while the popup is under 1100 wide), a 1px `panel-rule` between them. Footer 64, pinned.
- **Under 1024 px, or in portrait:** the same content as a full-screen sheet, one long scroll under a sticky, shrinking preview (PhoneForms card).
- Opens from New Project's Convert image, or by dropping or pasting a picture on the app, which opens it with the picture set. Motion as Modal.

## Footer

- Cancel (secondary), the result line in `meta` (`body`), centred, and Create Project (primary), both `field-height`: "32×24 beads · 5.1 × 3.1 cm · 8 colors". With no picture the line reads "No picture yet" in `muted` and Create Project is disabled (the disabled sections say why).
- Create Project makes the Project from the popup's own copy of the setup and closes it. Its Palette is its built-in colors plus every color its beads use (spec 0645).
- **Cancel asks in place.** One modal at a time (accessibility.md), so with a picture set, Cancel, Close and Escape turn the footer into the question: the warning icon, "**Discard conversion?** The picture and every setting here will be lost. The New Project form stays as it was.", then Cancel (first, focused) and Discard (`danger` fill). With no picture they close at once.

## Sections as steps

- Five sections in one column, all open, in order: 1 Picture, 2 Bead & Technique, 3 Size, 4 Colors, 5 Review. Each is padded 14 20 18 (12 16 16 on a phone) with a 1px `panel-rule` under it. Its header (28 or more) holds the step disc, the title in `control` at 600, and at the right a `meta` summary of what it holds now: "delica 11/0 · loom", "32×24 · 8:1", "bead colors · 8", "≈ 1.8 g".
- **Step disc** (`--step-disc`, 20): the number in `meta-small` inside a 1px `line-strong` ring on `overlay-fill`. Picture's disc becomes a 12px check on `ink` once a picture is set. The later sections take no check: their defaults are valid from the start, so a check would mean nothing.
- **Disabled until a picture is set:** sections 2 to 5 draw only their header, the disc in `line` and `faint`, the title `faint`, and "Add a picture first" in place of the summary; `aria-disabled`.
- **Step rail:** sticky at the top of the sections pane, 44 tall (40 on a phone), `overlay-fill`, a 1px `panel-rule` under it: the five discs joined by 1px `line` hairlines, each followed by its `label` (picture, bead, size, colors, review); a phone names only the section in view. The section in view takes a 2px `ink` ring 2px out and an `ink` label. A press scrolls to that section and moves focus to its header. One Tab stop, arrows inside, `aria-current="step"`.

## Preview pane

- `box` fill. The picture drawn as beads by the Project renderer in the Frame's space (Real bead shape, the dragging draft look), redrawn on every change; the Frame line in `ink` (1.5px, with a 1.5px `canvas` halo so it reads over any picture); the size tag "32×24" in `meta-small` on `ink` above the Frame's top-left corner.
- **By Pixel to bead ratio, crop:** the whole picture is the Frame at first. Four 16px corner handles (`--crop-handle`, `canvas` fill, 2px `ink` edge, radius 3) and four 28 × 8 bars at the edges' middles crop it, snapping to whole pixel blocks. The picture stays outside the crop, dimmed by `--framing-dim`. A focused handle moves one block per arrow.
- **By size, pan:** the Frame stays in the middle; the picture, zoomed by the Size section's slider, is dragged under it and never uncovers it, dimmed outside it. A hint on `overlay-fill` at the bottom left, the `hand` icon and "Drag the picture to move it under the Frame", until the first drag. Arrows pan by one bead, Shift + arrows by ten.
- **Zoom** (the view only; it never changes what is framed): zoom out, the level, zoom in and Fit, floating at the bottom right on `overlay-fill` with `elevation-3`, the Canvas strip's buttons; pinch and wheel too.
- **Treat as empty:** a 34px button at the top left, the `eyedropper` icon and its name (icon only on a phone or a shrunk preview). Pressed: `accent-strong` icon and text and a 2px inset `accent-strong` edge, `aria-pressed`. While it is on, the pointer is the eyedropper, the bead under it is ringed (2px `ink`, `canvas` halo), and a banner on `ink` says "Tap a color on the preview to make it empty" (an `esc` key chip with a keyboard). A tap sets that found color to empty; Escape or the button ends it.
- **Empty:** the pane is the drop zone, inset 24 (16 on a phone): a 1.5px dashed `line-strong` edge, `radius-lg`, the 32px `image` icon, "Drop a picture here" in `control` and "or paste one with Ctrl+V" ("or choose a file below" on touch) in `meta`.
- **A picture dragged over the popup:** a 2px dashed `accent-strong` edge inset 12 on `surface` at 92%, the icon and "Drop to use this picture" in `accent-strong`, the limits in `meta`. Dropping replaces the picture and keeps every other setting; the crop or pan starts over.
- **A picture dragged over the app** (popup closed): the scrim and a centred 400 × 220 card in the same drop look, "Drop to convert image" and "PNG, JPEG, GIF or WebP · up to 10 MB". Dropping opens the popup with the picture set.
- The pane is `role="img"` named "Preview: 32×24 beads, 8 colors"; its controls are buttons.

## 1 Picture

- **No picture:** Choose file (primary, `import` icon, the FileButton's `accept`), Paste (`paste` icon; the async Clipboard API, and Ctrl/Cmd+V works anywhere in the popup), and Take photo on a touch device (a file input with `capture`; the icon set has no camera, so it has no icon), all `field-height`, wrapping.
- **With a picture:** a 64 × 48 thumbnail of the pixels (1px `line` edge), the file name in `control` and "256×192 px · png" in `meta`; then small (28) in-box buttons: Turn 90° (`rotate` icon) and Flip (left to right; no icon in the set), and at the right `replace` with Choose file and Paste (wrapping to a second row when they do not fit). Turn and Flip change the pixels before sampling and start the crop or pan over.
- **Note**, always: "Drop a picture anywhere on the app, choose a file or paste one with Ctrl+V. PNG, JPEG, GIF or WebP, up to 10 MB and 16 megapixels." On touch: "Choose a file, paste a picture or take a photo. …"
- **Errors** (HEIC, SVG, too big, too many pixels, unreadable, wrong format) keep the app's sentences, in an inline Message under the buttons (`danger` edge, the warning icon, `role="alert"`). A picture already set stays set.

## 2 Bead & Technique

- The New Project form's own sections in panel rows (ProjectPanel card): bead (Brand, Type and Size PanelPickers), bead shape (small SegmentedControl, Symmetric | Real), technique (PanelPicker, with the Brick block row for brick stitch). They start from the form's values and are the popup's own copy.
- Note: "Starts from the New Project form. Cancel leaves the form as it was."

## 3 Size

- A SegmentedControl: By Pixel to bead ratio | By size (labels wrap to two lines). Switching carries the numbers across: a ratio's result becomes the fields, a size becomes the nearest ratio.
- **By Pixel to bead ratio:** the PixelToBeadRatio card, then "Drag the handles on the preview to crop. They snap to whole blocks." in `small`.
- **By size:** unit, a small mono SegmentedControl (beads | mm | cm); Width and Height NumberFields side by side; Keep picture proportions (Switch, on); picture zoom: the `zoom-out` icon, a slider (QualitySlider look), the `zoom-in` icon and the percent in `meta` (100% = the picture just covers the Frame).
- **The result box**, both modes (PixelToBeadRatio card): "32×24 beads · 5.1 × 3.1 cm · 1 bead = 8 × 8 px"; By size "40×37 beads · 6.4 × 4.8 cm · 1 bead ≈ 4.3 × 3.5 px".
- **Slow framing:** an inline Message, warning edge and icon, with the app's sentence. **Large Schema:** a Note, "Large Schema: more than 300 beads on a side. Converting and drawing take longer." (threshold set with the build).
- **Starting proposal** (spec 0645): a picture under about 400 px on its long side starts in By Pixel to bead ratio, at the preset that gives the most beads up to 150 on the long side, else 1:1; a larger one starts in By size.

## 4 Colors

- **match to:** one SegmentedControl, Bead colors | Default Palette | Exact. A Bead without a Color catalog shows Default Palette | Exact; with one, Bead colors is the default.
- **Under Bead colors only:** one line in `meta-small` counting the codes the match uses, "codes in 11/0: 1 211": the codes made in the Bead's size, discontinued ones left out. No filter for now (spec 0645's Finish chips and Include discontinued are left out of this design).
- **A Note** says what the source does: Bead colors repeats the BeadColors approximate note; Default Palette "Matches each color to the nearest of the Bead’s 16 default colors." (12 for a Brand without its own set); Exact "Keeps the picture’s own colors. Each joins the Palette as a Custom color."
- **Colors at most:** a small Stepper, 1 to 14, default 12.
- **colors found**, the count at the right: one FoundColorRow per found color, most beads first (FoundColorRow card).

## 5 Review

- Name and Maker's name, TextFields side by side (stacked on a phone), each "optional"; Name's placeholder is the file's name.
- The summary box (`surface`, `radius-lg`, padding 4 12): size, colors, beads needed, estimated weight and to buy as rows, the `label` at the left and the value in `meta` `ink` at the right; under a 1px `line`, one row per color: a 14px swatch, the code or name, beads, grams and tubes ("1 × 5 g", PrintSpecification's rule). On a phone the per-color rows sit behind Show details / Hide details.
- The grams Note: "≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares."

## Keyboard and screen readers

- The popup is a `dialog` named "Convert image". Focus enters on Choose file (or, with a picture set, the first control of Picture), is trapped, and returns to the opener on close.
- Tab order: Close; the preview's controls (Treat as empty, the crop handles or the picture, zoom); the step rail; the sections in order; the footer.
- Each section is a `region` named by its title. The result line and the found-color count are `role="status"`, read once after a change settles. Errors are `role="alert"`.

## Nothing remembered

No choice in the popup is kept on the device. Every opening starts from the New Project form and the starting proposal.

Hand-written from the ticket 0646 design session; the canvas has the layouts at 1280, 1024, 820 and 375, the three themes and Russian, Ukrainian and Polish.
