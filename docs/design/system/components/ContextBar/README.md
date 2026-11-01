# ContextBar

The thin bar anchored to a Selection, or to the Mirror's Area, that offers what it can do. It has no Frame mode: Edit Frame has no bar (ticket 427, ADR 0054). The Selection bar below is the design for tickets 414 and 415, and the app draws it since ticket 415; the Mirror bar is the same component with Mirror's items (ticket 0750, ADR 0082). Only one bar is on screen at a time.

## Selection bar (tickets 414, 415)

A Selection is **one rectangle, or one Piece's exact shape** (tickets 414, 547, ADR 0051). It is made three ways: the Select tool (drag), the Piece tool (tap one bead; the Selection is exactly that Piece's beads, so a Piece that isn't a rectangle gives a Selection that isn't, leaving out holes and other Pieces' beads inside its bounding rectangle) and the Select all button (one rectangle round every piece; Ctrl/⌘+A too). A rectangle is drawn as a 1.5px `marker` border with the Frame's eight handles (9px squares, 1.5px `ink`, radius 2, `canvas` fill); handle hit areas are 14px for mouse and pen, 24px for touch. A shape is drawn as the same 1.5px `marker` outline traced round its beads and round each hole, with no handles, and can't be resized or moved: a Select drag replaces it with a rectangle, a Piece tap on another Piece with that Piece's shape. Its size readout and Frame from Selection use the bounding rectangle.

- **Placement:** 6px above the Selection's top edge, centred on it, following pan and zoom, **clamped inside the canvas box** on every side. With no room above it flips below the bottom edge, same 6px. It is hidden while a gesture, pan or pinch runs and returns when it ends. `z-context-bar`.
- **Look:** `ink` fill, `canvas` icons and text, radius `--selbar-radius` (8px), `elevation-3`, padding 0 2px, 2px between items. A 1px `line-strong` border in the dark theme (no shadow there). Height `--selbar-height` (28px) with 16px icons on mouse and pen; `--selbar-height-touch` (36px) with 18px icons on touch. Buttons are square at the bar's height, radius-sm, hover and press mix `canvas` into the bar at 12% and 20%. Targets are never under `--hit-min` (24px).
- **Items, in order:** the size readout, Select all (only while the Select tool is active, ticket 428), Copy, Cut, Paste (the `paste` icon, only while the clipboard holds something; it enters paste mode and stamps nothing, ticket 447), Fill, Frame, a divider, Clear selection.
  - **Size readout:** the rectangle's size in beads and mm, "11×6 ≈ 3.5×1.9 cm" (`meta`, DM Mono 11px, `canvas` at 74%), 6px padding. No bead count: a Selection is a rectangle.
  - **Icons:** `copy`, `cut`, `fill-selection`, `frame` (the Frame tool's own `#`) and `delete`.
  - **Only what applies is rendered:** Remove line only when a line of the Frame is selected. **Frame is offered with or without a Frame:** it sets the Frame to the Selection, or moves it there (ticket 407, e.g. onto another named Schema). **Fill** is disabled, with its reason in a Tooltip, until a color is chosen.
  - **Clear selection** is the only destructive item: its icon takes `--selbar-danger` (danger lifted toward white on the light bar's `ink`, plain `danger` on the dark theme's light bar). It sits after a divider.
  - **Dividers:** 1px by 16px, `canvas` at 28%, 3px each side, between the readout and the actions and before Clear selection.
- **While the Selection is dragged or resized:** the same bar, in the same place above the Selection, shrinks to its size readout alone ("11×6 ≈ 3.5 × 1.9 cm", changing as the rectangle grows or shrinks) and expands to the full bar on release, so there is one bar and it never jumps. It does so only while the handles and the ruler numbers show (a Selection of five beads or more, Rulers on); otherwise it hides during the gesture, as before.
- **No Add or Subtract toggle:** nothing combines rectangles.
- **Names:** icon-only. Each button has an accessible name and a Tooltip with its key (Ctrl+X, Del...). The bar is `role="toolbar"` named "Selection". When it cannot fit the canvas box, the last actions fold into a "…" menu.
- **Select all with no Selection (ticket 428):** with the Select tool active and no Selection, the bar is Select all alone (icon-only, the `select-all` icon), floating at the canvas box's top-centre. With a Frame it selects the Frame's inside, without one the bounding rectangle of all beads.
- **Paste mode (ticket 437, ADR 0016):** there is no bar. Copy clears the Selection and arms paste mode, and the "Tap to paste" and Cancel bar is gone (Cut arms it the same way, ticket 447; the Paste icon above and the Tool pill's Paste tile re-enter it); Select all is hidden while paste mode is on. Escape, right-click or another tool leaves it (on touch also Undo or a second tap on Select).
- **Select all, then Clear selection** asks for confirmation, because it would wipe the drawing (ticket 415).

Design reference: the "Selection bar on the canvas" board of the design canvas (rectangle, a piece, select all, touch).

## Mirror bar (ticket 0750, ADR 0082)

The Mirror's own bar: the Selection bar's component (same look, sizes, hover and press, dividers, Tooltips, `role="toolbar"`), with Mirror's items. It replaces the Mirror popover, which is retired with its card. Approved from the claude.ai mockups "Mirror bar mockups", variant B (https://claude.ai/artifact/YDqoGhLJKvK1ZWjtiE2phV), 2026-10-31.

### The Mirror and its Area

- **One Mirror per Project**, saved with it, off by default. Its **Area** is a rectangle on the Canvas or the whole Frame, never a smaller part of a Frame; making a Mirror always replaces the one before. Three ways make one: the Mirror tile (key `7`, ToolPill card) and a drag on the Canvas; the whole-Frame Mirror icon on the Frame's margin (MarginSheet card); a Selection and the Selection bar's Mirror (above).
- **Mirror mode** (the tile's pick) is the Select tool's own drag gesture and rubber band, not a copy of it: the 1.5px `marker` rectangle round the cells from the press to the pointer. Release makes it the Area at once and shows the bar; the first time the Mode is Mirror with Left–right on. The pointer over the Canvas is the Select tool's. A drag that begins in the Frame or its keep-out margin is refused: the `not-allowed` cursor over them while the pick is on, and the margin's dashed refusal flash of the keep-out rule on a press. There is no hint line: the lit tile and the cursor say it (the CanvasHint's pick line is retired).
- **A Canvas Area** is drawn as a rectangle Selection: the 1.5px `marker` border (`--mirror-area-line`) with the eight 9px handles (`--mirror-area-handle`), the same hit areas. The handles resize it and a drag inside it moves it, while Mirror mode is on (the Select tool's own resize and move); with a drawing tool the press is the tool's and the Area is only drawn. The **whole-Frame Area** has no outline or handles of its own: the Frame's line is its edge.
- **On the canvas, whatever tool is active,** not hidden by the Rulers toggle, never in exports, on the canvas overlay layer in the Area's geometry:
  - **Axis lines:** `marker`, `--mirror-axis-width` (1.25px), dash `--mirror-axis-dash` (5 4), across the Area. A straight Axis runs through the Area's centre; with an Axis count of N, N lines cut it into N+1 equal strips.
  - **Radial:** the centre is a ring, `--mirror-ring-radius` (7px), 2px `marker`, at the Area's centre. Mirror mode: the Fold's mirror lines through it, 180° over the Fold apart, the first vertical and full, the others at `--mirror-axis-soft` (45%). Repeat: the Fold's rays from it, 360° over the Fold apart, the first straight up. On a round Custom frame the ring is at the layout's centre and the first line or ray runs along the shape's first Seam, clipped to the Frame's rectangle; a Kite's or Fringe earring's one line runs through the layout's centre.
  - **Hover preview:** every counterpart under the pointer at `--mirror-ghost-opacity` (45%) of the colour with a 1.5px `marker` outline (an Eraser's with no fill).
- **Counterparts** land only inside the Area: one outside it, in the keep-out margin, on a Seam or Off-shape, or in a finished row is dropped silently, as Paste drops; a gesture outside the Area is not mirrored. The rules (by index on a grid at Fold 2 and 4 as Rotate turns a fragment, geometric on a Custom frame) are the glossary's Axis entry.

### Placement

- **A Canvas Area:** exactly as the Selection bar: 6px above the Area's top edge, centred on it, following pan and zoom, clamped inside the canvas box; with no room above it flips 6px below the bottom edge. `z-context-bar`.
- **The whole Frame:** 6px above the margin sheet's outer top edge, centred on the sheet, so it never covers the band's tools or the Frame; with no room above, 6px below the sheet's bottom edge. In the bare form (no sheet drawn) it stands above the Move bar.
- **Shown whenever the Mirror is on,** whatever tool is active. Hidden while a gesture, pan or pinch runs, back when it ends. While the Area is resized or moved it shrinks to its size readout alone, in place, and grows back on release, as the Selection bar does. **While a Selection exists it gives way to the Selection bar** (the Area's outline and Axes stay drawn) and comes back when the Selection clears.

### Items, in order

`size · | · Mode · | · Left–right · Top–bottom · Radial · | · Close mirror`

- **Size readout:** the Area's size in beads and cm, "12×8 · 4.2 × 2.6 cm" (`meta`, DM Mono 11px, `canvas` at 74%, 6px padding), the Selection bar's readout. For a Custom frame the shape's name first: "Star · 21×20 · 3.4 × 3.2 cm".
- **Mode:** a two-segment switch, **Mirror | Repeat** (Mirror the default; no Off: Close mirror is the way out), `role="radiogroup"` named "Mode". `--mirror-bar-control` tall (24px; `--mirror-bar-control-touch`, 30px, on touch), a 1px `canvas` at 30% border, `radius-sm`, 1px inner padding; each segment Inter 500 12px in `canvas` at 74%, 8px side padding; the chosen one filled `canvas` with its text `ink` at 600.
- **Axis chips:** three icon-only toggle chips, `axis-left-right` (Left–right), `axis-top-bottom` (Top–bottom), `axis-centre` (Radial), `aria-pressed`, each named and with its Tooltip by its Axis's name. A chip is a `--mirror-bar-control` square cell (16px icon; 18px on touch) inside a 1px `canvas` at 30% border, `radius-sm`, 3px between chips. **On:** the border `canvas` and the icon cell filled `canvas` with its icon `ink`, the same look as the chosen Mode (on the `ink` bar the accent does not read: the dark theme's bar is white). Left–right and Top–bottom may be on together; Radial on turns them off and remembers them, Radial off brings them back. At least one Axis is always on: pressing the last one on does nothing.
- **Counts on the chips:** while a chip is on, its Stepper is attached inside the same border, after the icon cell: −, the value, + (−/+ `--mirror-bar-control` square buttons with 12px icons, the value DM Mono 12px in `canvas`, at least 14px wide). Left–right and Top–bottom carry their **Axis count**, 1 to the Area's columns (or rows) minus 1, buttons "Fewer axes" / "More axes", the value read as "Left–right axes, 1"; Radial carries the **Fold**, 2 or 4 only (a half or a quarter turn, the two a grid takes exactly; a press steps between them), "Fewer folds" / "More folds", "Fold, 4". At a limit the button is `canvas` at 38%, `aria-disabled`. Resizing the Area smaller clamps a count.
- **A quarter turn needs a square Area** (ticket 0751): in an Area that is not square (a Canvas rectangle or the whole Frame) Radial's + is off like a limit, with Tooltip "A quarter turn needs a square area." («Для поворота на четверть нужна квадратная область.»), beside the one-bead-across line; an Area made or resized out of square clamps a Fold 4 to 2, and a square one later keeps 2. Any other Fold that comes to a grid (an older file's, a round Custom frame's side count) reads as 4.
- **A direction one bead across** (an Area one bead tall, or wide) has its chip off: the icon at 38%, `aria-disabled`, still focusable, Tooltip "The area is one bead tall." («Область высотой в одну бусину.») / "The area is one bead wide." («Область шириной в одну бусину.»).
- **On a Custom frame** the Axes are the shape's, fixed: no chips and no Steppers; in their place a note in `meta` (`canvas` at 74%): "Radial · 5, from the shape" («По кругу · 5, по форме»), "Left–right, from the shape" («Слева направо, по форме»). The Mode still switches (Repeat with Radial is a plain turn; with a straight line on a shape Repeat maps nothing, and the note then reads "Left–right, from the shape: Repeat needs Radial." («…: для повтора нужен круг.»)).
- **Close mirror:** the `close` icon after a divider, "Close mirror" («Закрыть отражение»), no key. It turns the Mirror off and drops its Area, keeping the Mode, Axes and counts for the next one; one Undo step. Not destructive (no beads change), so not in `--selbar-danger`.
- **Dividers** as the Selection bar's: after the readout, before the chips, before Close mirror.

### Too narrow

About 380px in English on mouse with two straight Axes on. Where the bar cannot fit the canvas box, first the size readout drops, then the bar takes **two rows** (twice its height, the same radius): the readout (if any), Mode and Close mirror on the first, the chips with their counts on the second. Nothing folds into a "…" menu: every control stays one press away.

### Undo, keys, names

- Setting, moving, resizing and closing the Area are one Undo step each; the Mode, the chips and the counts are not Undo steps.
- The bar is `role="toolbar"` named "Mirror" («Отражение»), in the Tab order where the Selection bar is (ADR 0075); arrows move along it. Escape in Mirror mode with nothing dragged leaves the pick for Paint and keeps the Mirror.
- Russian and the other languages follow `writing.md` (Mirror is «Отражение», Repeat «Повтор», Left–right «Слева направо», Top–bottom «Сверху вниз», Radial «По кругу», Fold «Частей»).

## Frame panel (retired)

The Frame panel of tickets 295 and 417 (the Frame's size, Fit to drawing, Remove Frame and Done) is gone (ticket 427, ADR 0054). Fit to drawing and Remove frame live in the Progress bar; Edit Frame ends with Esc, Enter or a tap outside the Frame, and the Frame's size shows in its tooltip.

## What the app does differently

- **Rotate** (Shift+R) turns the Selection a quarter turn clockwise about its centre; the turned rectangle becomes the Selection, the Frame is untouched, and beads under the new footprint are replaced (ticket 416, ADR 0052). Once a Row progress pass is done it is still rendered: disabled, with "This Selection reaches into finished rows.", where the Selection holds a bead of a finished pass, and enabled elsewhere, the Canvas included (ticket 0647). Until ticket 417 moves them, **Remove line** and **Name Piece** stay on the bar, after Fill, Frame and Rotate and before the divider; they are rendered only when they apply (a line of the Frame is selected; the Selection holds beads of one Piece). Remove line asks first where the line touches finished rows (ticket 0647).
- **Mirror** (ticket 0750), after Rotate, **always shown**: the `mirror` icon, named "Mirror", Tooltip "Mirror inside this area" («Отражать внутри этой области»), no key. It makes the Selection's rectangle (a shape's bounding rectangle) the Mirror's Area, replacing any Mirror wherever it was, clears the Selection and shows the Mirror bar in its place, exactly as a drag in Mirror mode does; one Undo step. **On a Frame Selection** it is disabled (the bar's disabled look, `aria-disabled`, still focusable) with the Tooltip "The Frame mirrors whole: use the Mirror on its margin." («Рамка отражается целиком: включите отражение на её поле.»). The one-shot copy of a fragment to its counterparts it was (ticket 0707) is retired with its strings and its Message.
- The "…" menu folds the last items first, Clear selection among them when it comes to that.

Hand-written from the responsive sign-off, then redrawn for tickets 414 and 415 from the design canvas; static rendition.
