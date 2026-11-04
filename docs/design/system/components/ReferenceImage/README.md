# ReferenceImage

One picture per Project, laid on the Canvas so the person can bead over it (tracing) or keep it beside the pattern as an example to copy from. Shown and hidden from the Canvas strip, set up in the Project panel's **reference image** section, and moved, resized and turned on the canvas in **Adjust**. Saved with the Project. Tickets 0790 (the picture, the strip button, the section) and 0791 (Adjust); mockups https://claude.ai/artifact/5x3g8P5eutFtqhh3Kox6Li. Design only until those tickets build it.

The word is **Reference image** everywhere (glossary, Canvas and Frame). Not "background image": **Background** is a layer's color (CanvasBackground card).

## On the canvas

- **Where it is drawn:** over every layer's Background (the Canvas's and the Frame's, a Custom frame's Off-shape included) and under every bead, every layer's. The rulers, the margin sheet, the Frame line and its gutter controls are drawn over it. It is in Canvas coordinates: it pans and zooms with the beads and turns with Rotate canvas (its own turn adds to the Canvas's).
- **Opacity:** four steps, 25%, 50% (a new picture's), 75% and 100%, stored as the step. No slider.
- **Painted beads** cover it as they are. **Empty beads** become see-through so the picture reads between them: their fill (the background's empty bead) drawn at 50% under the 25% step, 37% under 50%, 25% under 75% and 12% under 100%, always with the `bead-rim`, so the grid stays readable. With the picture hidden, empty beads are drawn as before.
- **Two uses, no mode:** over the bead area at 25 or 50% it is a tracing guide; moved beside the pattern at 100% it is an example to copy from. Nothing covers it outside the bead area.
- **A new picture** is fitted inside the Canvas's beads (the box round them; a new Canvas's whole grid), centred, turn 0°, and lands in Adjust when it was picked from the strip button.
- **Never printed:** PNG, PDF, the Projects library thumbnail and the Homepage examples leave it out.
- **High contrast:** shown as in light; the empty-bead fill follows the same steps on the white canvas.
- Every tool works over it as usual. Outside Adjust nothing on the canvas can grab it, so a stroke, a Fill or a Selection never moves it.

## Canvas strip button

- The `reference-image` icon (the `image` picture with a dashed edge), plain look, right after the Rulers toggle, before Undo (CanvasStrip card). Name "Reference image". Shown only with a Project open; at every width, scrolling with the tools on a phone.
- **No picture yet:** not a toggle (no `aria-pressed`). A press opens the file picker (the Convert image picker's formats); a picked picture is fitted and opens in Adjust. Tooltip "Add a reference image".
- **With a picture:** a toggle, `aria-pressed`, the Rulers look (pressed: `ink` fill, `canvas` icon). Tooltip "Hide reference image" while shown, "Show reference image" while hidden, with the key chip `I` (control registry).
- Shown or hidden is saved with the Project; a new picture is shown.

## Project panel section

A PanelSection **reference image** between canvas and export (ProjectPanel card), built from the MenuPanel card's shared parts.

- **Header:** the `label` "reference image", an Info button (`info`, 16px, ButtonCard's Info button) and the chevron. Folded summary in `meta`: "50% · shown", "50% · hidden", or nothing with no picture. The Info Tooltip: "PNG, JPEG, GIF or WebP, up to 10 MB. Kept with this Project and in its .openbeads file, never printed. Large pictures are made smaller to fit." (the numbers filled from the Convert image limits).
- **No picture:** one PanelItem, `image` icon, "Add reference image"; it opens the file picker and, on a pick, puts the panel away and opens Adjust.
- **With a picture**, in this order:
  1. A PanelListRow (no trailing facts): the 28px thumbnail (the picture cropped square, on `board`), the file name (one line, ellipsis) over "2048 × 1536 · 412 KB" (the stored picture) in `small` / `muted`. Not a button.
  2. **Opacity:** a row with the label in `body` and, at its right, a four-choice SegmentedControl in the PanelPicker's height (`picker-height`), the values in `pill` type: 25%, 50%, 75%, 100%. Arrows move and apply at once. Named "Opacity", each choice "50%".
  3. **Adjust on canvas** (`size` icon, value "move · resize · turn" in `meta`): puts the panel away and opens Adjust (below). While the picture is hidden it shows it first, so Adjust never handles an unseen picture.
  4. **Replace image** (`image`): the file picker; the new picture keeps the place, the turn and the width, its height following its own shape.
  5. **Remove image** (`delete`, `danger`): asks "Remove the reference image?", "The picture is taken off this Project. Your beads stay as they are.", Cancel and a `danger`-filled "Remove" (ConfirmDialogs card). Not an Undo step.
- Show and hide is not repeated here: it is the strip button (MenuPanel card: nothing repeats a tool).
- A refused file keeps the panel open and shows a `danger` line under the section's first row, in `small`: "This file can't be used: {reason}", the reasons Convert image gives (not a picture, over 10 MB, over 16 megapixels, couldn't be read).
- While the picture is read and made smaller, the section's first row shows the Loading card's inline spinner and "Preparing the picture…".

## Adjust (ticket 0791)

A state of the canvas, not a mode of a tool: the tools rest, pinch, two-finger pan and the scroll wheel still move the view. The picture's outline and handles are drawn in screen pixels, like the Frame's (Frame card: Gutter, resize handles, Move handle), so they keep their size at every zoom.

- **Outline:** 1.5px `ink` round the picture, turned with it.
- **Move:** drag anywhere inside the picture. Cursor `grab`, `grabbing` while dragged.
- **Resize:** four corner handles, the Frame's resize handle (9px, 1.5px `ink`, radius 2, filled with the canvas background, standing 7.5px off the corner, 11px on touch), grabbed within 14px, 44px to hit on a coarse pointer. The picture keeps its shape and the opposite corner stays put. Diagonal resize cursors, turned with the picture. No smaller than 4 beads across; no larger than ten times the Canvas's box.
- **Turn:** one handle, a 28px circle (1.5px `ink`, canvas fill, a 12px turning arrow inside; `accent` fill while dragged) on a 1.5px dashed `ink` stem, `--frame-control-offset` (48px) above the top edge's middle, turned with the picture; below the bottom edge when there is no room above, kept inside the canvas box. Free turn, snapping to 0°, 90°, 180° and 270° within 4°; Shift snaps to every 15°. While dragged, a Tooltip-look chip beside it shows the angle in DM Mono ("12°").
- **Adjust bar:** a pill on `canvas`, 1px `box-line`, `elevation-3`, centred 14px above the drawing area's bottom (over the Tool pill's place: the pill hides while adjusting): the `label` "reference image", **Fit to Canvas** (`reset`, secondary) and **Done** (`check`, primary). On a phone the label goes and the buttons read "Fit" and "Done", 44px tall.
- **Ends** on Done, Escape, or a press outside the picture and its handles (that press only ends it). Fit to Canvas puts the picture back to the new picture's fit, turn 0°, and stays in Adjust.
- **Keyboard:** the picture is focused when Adjust opens; arrows move it one bead (Shift: ten), `+` and `−` resize it by a tenth, `[` and `]` turn it 15°. Tab moves to Fit to Canvas and Done.
- **Screen readers:** the picture is a `group` named "Reference image, 50%, turned 12°", the handles buttons named "Resize from the top-left corner" (and the other three) and "Turn"; each change is announced politely ("Turned 15°").
- **A view, like Background:** shown or hidden, opacity, place, size and turn are saved with the Project and are not Undo steps; Row progress never holds them.
- **Reduced motion:** nothing animates in Adjust; the bar fades in and out.

## Limits and saving

- **Picked:** the Convert image formats and caps (PNG, JPEG, GIF's first frame, WebP; at most 10 MB and 16 megapixels).
- **Stored made smaller:** at most 2048 px on its longest side, WebP where the browser encodes it, else JPEG (PNG when it has transparency), stepped down until it is at most 1 MB. The row's size line shows what is stored.
- **Where:** the picture's bytes beside the Project library on the device, the settings with the Project, and both inside the `.openbeads` file (ADR 0089, ticket 0790). Duplicate copies it; Delete and Delete all remove it.
- **Not saved:** a device that refuses to keep it (a private window can) shows the picture for the session, and the Project panel's local save icon says "Reference image not saved on this device".

## Copy

English: Reference image, Add a reference image, Show reference image, Hide reference image, reference image (section label), Add reference image, Opacity, Adjust on canvas, move · resize · turn, Replace image, Remove image, Remove the reference image?, The picture is taken off this Project. Your beads stay as they are., Remove, This file can't be used: {reason}, Preparing the picture…, Fit to Canvas, Fit, Done, shown, hidden, Resize from the top-left corner, Turn, Turned {n}°, Reference image not saved on this device. Russian, Ukrainian and Polish are in `writing.md` (Reference image copy); the rest are written with the build.

Hand-written from the ticket 0790 mockups; static rendition.
