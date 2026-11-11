# ReferenceImage

One picture per Project, laid on the Canvas so the person can bead over it (tracing) or keep it beside the pattern as an example to copy from. Shown and hidden from the Canvas strip, set up in the Project panel's **reference image** section, resized and turned from its handles whenever it is shown, and moved on the canvas in **Adjust**. Saved with the Project. Built by ticket 0790, its handles outside Adjust and Replace on the Adjust bar by ticket 0799 (the picture, the strip button, the section and Adjust; ADR 0089 for where the picture is kept); mockups https://claude.ai/artifact/5x3g8P5eutFtqhh3Kox6Li.

The word is **Reference image** everywhere (glossary, Canvas and Frame). Not "background image": **Background** is a layer's color (CanvasBackground card).

## On the canvas

- **Where it is drawn:** over every layer's Background (the Canvas's and the Frame's, a Custom frame's Off-shape included) and under every bead, every layer's. The rulers, the margin sheet, the Frame line and its gutter controls are drawn over it. It is in Canvas coordinates: it pans and zooms with the beads and turns with Rotate Canvas (its own turn adds to the Canvas's).
- **Opacity:** four steps, 25%, 50% (a new picture's), 75% and 100%, stored as the step. No slider.
- **Painted beads** cover it as they are. **Empty beads** become see-through so the picture reads between them: their fill (the background's empty bead) drawn at 50% under the 25% step, 37% under 50%, 25% under 75% and 12% under 100%, always with the `bead-rim`, so the grid stays readable. With the picture hidden, empty beads are drawn as before. On the Canvas outside the Frame the empty positions are the Position marks, outlines with no fill, drawn over the picture as they are; the steps are the Frame's empty beads', in the full look and the draft look at small zoom alike.
- **Two uses, no mode:** over the bead area at 25 or 50% it is a tracing guide; moved beside the pattern at 100% it is an example to copy from. Nothing covers it outside the bead area.
- **A new picture** is fitted inside the Canvas's beads (the box round them; a new Canvas's whole grid), centred, turn 0°, and lands in Adjust when it was picked from the strip button.
- **Never printed:** PNG, PDF, the Projects library thumbnail and the Homepage examples leave it out.
- **High contrast:** shown as in light; the empty-bead fill follows the same steps on the white canvas.
- Every tool works over it as usual. Outside Adjust only its handles can grab it (below), so a stroke, a Fill or a Selection over the picture never moves it.

## Handles while shown (ticket 0799)

Whenever the picture is shown and the editor is in view, its four corner handles and its Turn handle stand on it, as Adjust draws them (below), so the person resizes and turns it at any time, whatever tool is in hand. A drag on one works as in Adjust (shape kept, opposite corner put; snapping, Shift, the angle chip) and is saved on release, no Undo step, announced as in Adjust. Outside Adjust:

- no outline round the picture, so no line sits over the beads being traced;
- the picture itself takes no press: a press on it is the tool's, so moving it, the keys and Fit to Canvas stay Adjust's;
- no Tab stop, no Escape and no press outside to end anything; the handles are buttons named as in Adjust;
- hidden with the picture, and while Convert image fills the drawing area.

Where a handle lies over the Frame's own resize handle (Edit Frame on, the picture's corner on the Frame's), the picture's handle takes the press.

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
- **Turn:** one handle, a 28px circle (1.5px `ink`, canvas fill, a 12px turning arrow inside; `accent` fill while dragged) on a 1.5px dashed `ink` stem, `--frame-control-offset` (48px) above the top edge's middle, turned with the picture; below the bottom edge when there is no room above, kept inside the canvas box. Free turn, snapping to 0°, 90°, 180° and 270° within 4°; Shift snaps to every 15°. While dragged, a Tooltip-look chip beside it shows the angle in DM Mono ("12°").
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

Hand-written from the ticket 0790 mockups; static rendition.
