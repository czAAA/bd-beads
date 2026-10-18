# ToolPill

The tools as a floating pill over the canvas, replacing the Dock (picked from the Tool pill proposal: pill 3, Grip pill, with colour control D, the chosen colour with its recents). The `Dock` card stays as the record of the bar it replaces, like `Toolbox`.

## Layout

- **The canvas box is the screen.** It sits `screen-edge` (12px) from every screen edge; where `env(safe-area-inset-*)` is larger, the inset wins on that side. Inside it, top to bottom: the Canvas strip, the drawing area, the Progress bar as a footer. The Progress bar and the Canvas strip keep their specs; nothing sits below the canvas box any more.
- **The pill floats over the drawing area**, `pill-gap` (6px) in from the drawing area's edge on the side it is docked to, centred along that edge. The drawing runs behind it: the pill takes no width or height from the canvas. It never covers the Canvas strip or the Progress bar.
- **Four positions:** left, top, right, bottom (default: bottom, just above the Progress bar). On left or right the pill is vertical and its contents run top to bottom.
- **Length:** as long as its content. If that is longer than the edge (a phone, top or bottom, with recents), the pill scrolls along its length with no scrollbar, like the Canvas strip.
- **Stacking:** on the canvas overlay layer (`z-canvas-overlay`), above the beads, the Frame and the Selection bar's anchor, below toasts, sheets and modals.

## The pill

- **Material:** `elevated` fill, 1px `line` border, `elevation-2`, `radius-full`; `pill-thickness` (48px) across: 40px tiles in 4px padding, 2px between tiles.
- **Order, leading end first:** the grip, `Paint | Fill | Select | Eraser | Hand | Piece` (keys `1` to `6` in that order, so the badges never skip, ticket 0461), then, only while the clipboard holds something, a **Paste** tile (the `paste` icon, key `7`; it enters paste mode and stamps nothing, and is the lit tile while paste mode is on, ticket 447), a divider, then the colour control. Nothing follows it: the pill holds only tools and the colour control (ticket 0443). On left or right the leading end is the top.
- **Grip:** an 18 × 40px handle (40 × 18px when vertical) drawing a 4 × 22px `line-strong` bar, `radius-full`. It says "this moves" without a hint. The whole pill can be dragged; the grip is where the cursor is `grab`.
- **Tool tiles:** 40px, `radius-lg`, 22px icon in `muted`; hover `hover-fill` and `ink`, pressed `press-fill`. The active tool sits on `panel` with its icon in `accent`. Each tile keeps its hotkey digit (1, 2, 3, 6, 4, 5) in the top-right corner, `meta-tiny`, `muted`, `accent-strong` on the active tile; the digits follow the hotkey-chip rule (ticket 438), so a touch-only device hides them.
- **Dividers:** 1px `line-soft`, 24px long, 4px margin, across the pill's length.
- **Pen/Mouse is not on the pill (ticket 0443, spec 0440).** It is the Input row in Menu, shown once a pen has been seen (MenuPanel card). The `pen-mode` / `pen-mode-off` icons stay in the set.
- **Phones under 400px**, top or bottom: tiles stay 40px and the pill scrolls rather than shrinking.
- **No Project open:** New Project and Import sit under the EmptyCanvas message and there is no pill.

## Colour control

- **The tile:** one 40px tile with the chosen colour as a 22px round swatch carrying a 14px `palette` icon in the mark that reads on it (`swatch-mark-dark` or `swatch-mark-light`), ringed (`ring`, 2px gap in the pill's fill). Tap: opens the colour popover. The pill's length never changes.
- **Recents:** after the swatch tile, the three colours used before it as 18px swatches on 30px-long tiles (30px tall when vertical). A recent swatch picks that colour at once; the swatch tile (with its palette icon) opens the popover. A pick moves the colour to the front of the recents (eight kept, on the device). Only while there is room: if the whole pill would be longer than its edge (a phone upright, a short window), the recents drop away and only the swatch tile stays, and they return when there is room again.
- No key opens the colour control; the swatch tile's accessible name is "Color, <colour name>" with `aria-expanded`.

## Colour popover

Replaces the Colour sheet on every device, phones included.

- `--popover-width` (288px) wide, `--pill-popover-radius` (24px) corners, `overlay-fill`, 1px `overlay-line`, `elevation-3`, padding 12px 14px 14px, 12px between sections.
- **Placement:** beside the pill toward the canvas, `pill-gap` away, centred on the tile that opened it and clamped `screen-edge` inside the screen. It never sits under the pill or off-screen. Opens with the pop motion (`duration-slow`, `ease-out`, from 94% scale), none under reduced motion.
- **Contents, top to bottom:** a head (the chosen colour as a 20px `radius-sm` swatch, its name, its hex in `meta-small` `muted`, Close); "recent", six chips; "palette", the PaletteSwatches grid with Pick color from canvas as its last tile; then Custom and Image colors side by side (ColorPickers).
- Picking a colour chooses it and closes the popover; Escape, Close, or a press outside close it too, and a press outside only closes.

## Moving the pill

- **Drag:** after 8px of movement the pill lifts (`elevation-3`-like shadow), follows the pointer, and four dashed `line-strong` drop zones show inside the drawing area; the nearest edge's zone turns `accent` with a 14% `accent` wash. Let go and the pill snaps there (`duration-slow`, `ease-standard`). Open popovers close when a drag starts. A drag never paints.
- **Keyboard and screen readers:** the grip is a focusable button, "Move tools", whose arrow keys move the pill to that edge; Menu also has "Tools position": Left | Top | Right | Bottom, under Preferences (MenuPanel card).
- The position is remembered on this device, like the theme (ADR 0020).

## Accessibility

- The pill is a `toolbar` named "Tools"; arrow keys move along it, Tab leaves it.
- Every tile has a `touch-target` hit area on coarse pointers; tiles and swatches stay apart by their gaps.
- On a busy Canvas colour the pill's border and shadow separate it; in high contrast it takes the 1px `line-strong` border.

Hand-written from the Tool pill proposal (2026-10-16); static rendition.
