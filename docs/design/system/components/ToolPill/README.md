# ToolPill

The tools as a floating pill over the canvas, replacing the Dock (picked from the Tool pill proposal: pill 3, Grip pill, with colour control D, the chosen colour with its recents). The `Dock` card stays as the record of the bar it replaces, like `Toolbox`.

## Layout

- **The canvas box is the screen.** It is flush with every screen edge; only `env(safe-area-inset-*)` (notch, rounded corners, home indicator) sits round it, with square corners, no border and no shadow. Inside it, top to bottom: the Canvas strip, the drawing area, the Progress bar as a footer. The Progress bar and the Canvas strip keep their specs; nothing sits below the canvas box any more.
- **The pill floats over the drawing area**, `pill-gap` (6px) in from the drawing area's edge on the side it is docked to, centred along that edge. The drawing runs behind it: the pill takes no width or height from the canvas. It never covers the Canvas strip or the Progress bar.
- **Four positions:** left, top, right, bottom (default: bottom, just above the Progress bar). On left or right the pill is vertical and its contents run top to bottom.
- **Length:** as long as its content. If that is longer than the edge (a phone, top or bottom, with recents), the pill scrolls along its length with no scrollbar, like the Canvas strip.
- **Stacking:** on the canvas overlay layer (`z-canvas-overlay`), above the beads, the Frame and the Selection bar's anchor, below toasts, sheets and modals.

## The pill

- **Material:** `elevated` fill, 1px `line` border, `elevation-2`, `radius-full`; `pill-thickness` (48px) across: 40px tiles in 4px padding, 2px between tiles.
- **Order, leading end first:** the grip, `Paint | Fill | Select | Eraser | Hand | Piece` (keys `1` to `6` in that order, so the badges never skip, ticket 0461), then the **Mirror** tile (the `mirror` icon, key `8`; not a tool but a mode, lit while the mode is not Off whatever tool is active, and its press opens the Mirror popover: MirrorPopover card, spec 0702), then, only while the clipboard holds something, a **Paste** tile (the `paste` icon, key `7`; it enters paste mode and stamps nothing, and is the lit tile while paste mode is on, ticket 447), a divider, then the colour control. Nothing follows it: the pill holds only tools and the colour control (ticket 0443). On left or right the leading end is the top.
- **Grip:** an 18 × 40px handle (40 × 18px when vertical) drawing a 4 × 22px `line-strong` bar, `radius-full`. It says "this moves" without a hint. The whole pill can be dragged; the grip is where the cursor is `grab`.
- **Tool tiles:** 40px, `radius-lg`, 22px icon in `muted`; hover `hover-fill` and `ink`, pressed `press-fill`. The active tool sits on `panel` with its icon in `accent`. Each tile keeps its hotkey digit (1 to 6, 8 on the Mirror tile, 7 on Paste) in the top-right corner, `meta-tiny`, `muted`, `accent-strong` on the active tile; the digits follow the hotkey-chip rule (ticket 438), so a touch-only device hides them.
- **Dividers:** 1px `line-soft`, 24px long, 4px margin, across the pill's length.
- **Pen/Mouse is not on the pill (ticket 0443, spec 0440).** It is the Input row in Menu, shown once a pen has been seen (MenuPanel card). The `pen-mode` / `pen-mode-off` icons stay in the set.
- **Phones under 400px**, top or bottom: tiles stay 40px and the pill scrolls rather than shrinking.
- **No Project open:** New Project and Import sit under the EmptyCanvas message and there is no pill.

## Colour control

- **The tile:** one 40px tile with the chosen colour as a 22px round swatch carrying a 14px `palette` icon in the mark that reads on it (`swatch-mark-dark` or `swatch-mark-light`), ringed (`ring`, 2px gap in the pill's fill). Tap: opens the colour popover. The pill's length never changes.
- **Recents:** after the swatch tile, the three colours used before it as 18px swatches on 30px-long tiles (30px tall when vertical). A recent swatch picks that colour at once (Shift+1, 2 and 3 do the same for the first, second and third, named "Recent 1" to "Recent 3" in the tooltip and the accessible name); the swatch tile (with its palette icon) opens the popover. A pick moves the colour to the front of the recents (eight kept, on the device). Only while there is room: if the whole pill would be longer than its edge (a phone upright, a short window), the recents drop away and only the swatch tile stays, and they return when there is room again.
- No key opens the colour control; the swatch tile's accessible name is "Color, <colour name>" with `aria-expanded`.

## Colour popover

Replaces the Colour sheet on every device, phones included.

- `--popover-width` (288px) wide, `--pill-popover-radius` (24px) corners, `overlay-fill`, 1px `overlay-line`, `elevation-3`, padding 12px 14px 14px, 12px between sections.
- **Placement:** beside the pill toward the canvas, `pill-gap` away, centred on the tile that opened it and clamped `float-edge` inside the screen. It never sits under the pill or off-screen. It is drawn in the app shell at `z-popover`, not in the canvas box, so the box's clipping and its bars (the Progress bar) never cover it, and a dialog opened from it still covers it (ticket 0725); no taller than the screen less `float-edge` at each end, it scrolls when what opens inside it (the Custom color picker) leaves no room. Opens with the pop motion (`duration-slow`, `ease-out`, from 94% scale), none under reduced motion.
- **Contents, top to bottom:** a head (the chosen colour as a 20px `radius-sm` swatch, its name, its hex in `meta-small` `muted`, the **Edit palette** pencil, Close); "palette" (in Edit palette followed by the **Remove all** bin), the PaletteSwatches grid (without the colours that are one of the pill's three recents while they are; no recents row here) with Pick color from canvas as its last tile; then Custom and Image colors side by side (ColorPickers).
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

### Edit palette in the head and the "palette" label (ticket 0531)

- **Pencil:** a plain 16px `IconButton` with the `pencil` icon, between the hex and Close, the same look as Close (`muted`, `hover-fill`, `ink` on hover). Shown only while the Palette has an added color. Tip "Edit palette" («Изменить палитру»); in the mode its tip is "Done editing" («Готово»), it is `aria-pressed="true"` and shows its icon in `accent` with `press-fill`, like the Pen/Mouse toggle. Pressing it again leaves the mode. What the mode does to the swatches is in the PaletteSwatches card.
- **Remove all:** only in the mode, a plain 16px `IconButton` with the `delete` bin icon, 6px after the word "palette" on the same line (the label keeps `meta-small` `muted`). Tip "Remove all custom colors" («Убрать все свои цвета»). It asks first (PaletteSwatches card). With no added color left the mode ends, so it never shows disabled.
