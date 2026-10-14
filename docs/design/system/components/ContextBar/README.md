# ContextBar

The thin bar anchored to a Selection that offers what it can do, and, while the Frame is being set, the Frame bar. The Selection bar below is the design for tickets 414 and 415; until 415 lands the app still draws the older bar described at the end.

## Selection bar (tickets 414, 415)

A Selection is always **one rectangle** (ticket 414). It is made three ways: the Select tool (drag), the Piece tool (tap one bead; every bead touching it is selected and the Selection is that piece's rectangle) and the Select all tile (one rectangle round every piece). It is drawn as a 1.5px `marker` border with the Frame's eight handles (9px squares, 1.5px `ink`, radius 2, `canvas` fill); handle hit areas are 14px for mouse and pen, 24px for touch.

- **Placement:** 6px above the Selection's top edge, centred on it, following pan and zoom, **clamped inside the canvas box** on every side. With no room above it flips below the bottom edge, same 6px. It is hidden while a gesture, pan or pinch runs and returns when it ends. `z-context-bar`.
- **Look:** `ink` fill, `canvas` icons and text, radius `--selbar-radius` (8px), `elevation-3`, padding 0 2px, 2px between items. A 1px `line-strong` border in the dark theme (no shadow there). Height `--selbar-height` (28px) with 16px icons on mouse and pen; `--selbar-height-touch` (36px) with 18px icons on touch. Buttons are square at the bar's height, radius-sm, hover and press mix `canvas` into the bar at 12% and 20%. Targets are never under `--hit-min` (24px).
- **Items, in order:** the size readout, Copy, Cut, Paste, Fill, Frame, a divider, Clear selection.
  - **Size readout:** the rectangle's size in beads and mm, "11×6 · 3.5×1.9 cm" (`meta`, DM Mono 11px, `canvas` at 74%), 6px padding. No bead count: a Selection is a rectangle.
  - **Icons:** `copy`, `cut`, `paste`, `fill-selection`, `frame` (the Frame tool's own `#`) and `delete`.
  - **Only what applies is rendered:** Paste with a clipboard; Frame without a Frame; Remove line only when a line of the Frame is selected.
  - **Clear selection** is the only destructive item: its icon takes `--selbar-danger` (danger lifted toward white on the light bar's `ink`, plain `danger` on the dark theme's light bar). It sits after a divider.
  - **Dividers:** 1px by 16px, `canvas` at 28%, 3px each side, between the readout and the actions and before Clear selection.
- **No Add or Subtract toggle:** nothing combines rectangles.
- **Names:** icon-only. Each button has an accessible name and a Tooltip with its key (Ctrl+X, Del...). The bar is `role="toolbar"` named "Selection". When it cannot fit the canvas box, the last actions fold into a "…" menu.
- **Armed paste:** an icon-only "Tap to paste" and Cancel, on the same bar, at the canvas box's top-centre.
- **Select all, then Clear selection** asks for confirmation, because it would wipe the drawing (ticket 415).

Design reference: the "Selection bar on the canvas" board of the design canvas (rectangle, a piece, select all, touch).

## Frame bar

**While the Frame is being set (v16), the Frame bar (ticket 295):** the Frame's size ("17×17 · 2.7 × 2.7 cm", `meta`), Fit to drawing (icon only), Remove Frame (✕, only when a Frame is set) and Done (check icon and label), on `ink`. It floats at the **top-centre of the canvas box** over the beads, 10px from its top, instead of taking a row above the Progress bar, and never covers the Dock. Done sets the Frame. From ticket 417 it is the same bar as above, anchored just above the Frame's top edge. Not drawn in the preview yet.

## Until ticket 415 (what the app draws today)

- A floating bar above the Progress bar under 1024px: its size (`meta`), Copy, Rotate, Remove line and a clear ×, on `ink` with `canvas` text, 14px radius, `elevation-3`, 40px buttons with 13px labels, 10px from the screen edges.
- After Copy it turns `accent` (`on-accent` text): "Tap where to paste", Rotate and Cancel.

Hand-written from the responsive sign-off, then redrawn for tickets 414 and 415 from the design canvas; static rendition.
