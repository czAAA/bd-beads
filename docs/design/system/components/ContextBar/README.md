# ContextBar

The thin bar anchored to a Selection that offers what it can do. It has no Frame mode: Edit Frame has no bar (ticket 427, ADR 0055). The Selection bar below is the design for tickets 414 and 415, and the app draws it since ticket 415.

## Selection bar (tickets 414, 415)

A Selection is always **one rectangle** (ticket 414). It is made three ways: the Select tool (drag), the Piece tool (tap one bead; every bead touching it is selected and the Selection is that piece's rectangle) and the Select all button (one rectangle round every piece; Ctrl/⌘+A too, and key 7 is free since ticket 431). It is drawn as a 1.5px `marker` border with the Frame's eight handles (9px squares, 1.5px `ink`, radius 2, `canvas` fill); handle hit areas are 14px for mouse and pen, 24px for touch.

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
- **Paste mode (ticket 437, ADR 0057):** there is no bar. Copy clears the Selection and arms paste mode, and the "Tap to paste" and Cancel bar is gone (Cut arms it the same way, ticket 447; the Paste icon above and the Tool pill's Paste tile re-enter it); Select all is hidden while paste mode is on. Escape, right-click or another tool leaves it (on touch also Undo or a second tap on Select).
- **Select all, then Clear selection** asks for confirmation, because it would wipe the drawing (ticket 415).

Design reference: the "Selection bar on the canvas" board of the design canvas (rectangle, a piece, select all, touch).

## Frame panel (retired)

The Frame panel of tickets 295 and 417 (the Frame's size, Fit to drawing, Remove Frame and Done) is gone (ticket 427, ADR 0055). Fit to drawing and Remove frame live in the Progress bar; Edit Frame ends with Esc, Enter or a tap outside the Frame, and the Frame's size shows in its tooltip.

## What the app does differently

- **Rotate** (Shift+R) turns the Selection a quarter turn clockwise about its centre; the turned rectangle becomes the Selection, the Frame is untouched, and beads under the new footprint are replaced (ticket 416, ADR 0052). It is not rendered once a Row progress pass is done (the Frame lock of ticket 411). Until ticket 417 moves them, **Remove line** and **Name Piece** stay on the bar, after Fill, Frame and Rotate and before the divider; they are rendered only when they apply (a line of the Frame is selected; the Selection holds beads of one Piece).
- The "…" menu folds the last items first, Clear selection among them when it comes to that.

Hand-written from the responsive sign-off, then redrawn for tickets 414 and 415 from the design canvas; static rendition.
