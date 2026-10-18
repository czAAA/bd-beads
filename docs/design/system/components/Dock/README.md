# Dock

**Replaced by the `ToolPill` card (Tool pill proposal, 2026-10-16).** Kept as the record of the bottom bar until the ToolPill ticket ships; build new work to ToolPill.

The bottom bar: the six tool tiles, the colour button and, where the device needs it, the Pen/Mouse toggle (ticket 431, ADR 0055). Menu and Project are not here: they are the first two buttons of the Canvas strip.

- **48px** tall plus `env(safe-area-inset-bottom)` capped at 4px, at most 480px wide and centred, on `canvas` with a 1px `line-soft` rule above, in portrait and landscape alike (there is no left rail). **No text labels at any height:** each button's name is its accessible name and its Tooltip.
- **Layout, left to right:** `Paint | Fill | Select | Piece | Eraser | Hand`, a divider, the colour button, and, once a pen has been seen (ticket 326), a second divider and the Pen/Mouse toggle. Slots share the width equally, a 22px icon each, `muted`; the tiles take the width they need and the bar stays centred, so with fewer slots it reads narrower than before.
- **Tool tiles:** each picks its tool at once (there is no Tool sheet). The active one is `accent` with the Toolbox's 2px accent underline and sits on `panel`; the others are `muted`. The hotkey sits in the top-right corner (1, 2, 3, 4, 5, 6 for Paint, Fill, Select, Eraser, Hand, Piece): DM Mono 12px, `muted`, 3px from the top and 6px from the right, `accent` on the active tool. Select all is not a tile: it is the Context bar's button, and key 7 is free.
- **Colour button:** shows the chosen colour as a 22px swatch with a ring, has no key, and opens the Colour sheet; it sits on `panel` while that sheet is open.
- **Dividers:** 1px `line-soft`, 24px tall, centred in the bar, between the tiles and the colour button, and between the colour button and Pen/Mouse.
- **Pen/Mouse toggle (ticket 325):** shows `pen-mode` (Pen mode) or `pen-mode-off` (Mouse mode) in `accent`, with no underline and no key; `aria-pressed` is true in Pen mode, and its Tooltip names the mode and what it does. It opens no sheet.
- **Phones under 400px:** tiles are 44px wide and the digit badges are hidden, so all eight slots and both dividers fit 360px without scrolling.
- **No Project open:** New Project and Import sit under the EmptyCanvas message; Menu is in the Canvas strip, which always shows.
- Mirror (ticket 174) is hidden pending a redesign. If its flag is turned on its button sits after the colour button and the bar needs a fresh 360px check, since it would be a ninth slot.
- The consumer provides the active tool, the current colour and which sheet is open.

Hand-written from the responsive sign-off; static rendition.
