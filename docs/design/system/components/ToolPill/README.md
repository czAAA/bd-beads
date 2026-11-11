# ToolPill

The tools as a floating pill over the canvas, replacing the Dock (picked from the Tool pill proposal: pill 3, Grip pill, with colour control D, the chosen colour with its recents). The `Dock` card stays as the record of the bar it replaces, like `Toolbox`.

## Layout

- **The canvas box is the screen.** It is flush with every screen edge; only `env(safe-area-inset-*)` (notch, rounded corners, home indicator) sits round it, with square corners, no border and no shadow. Inside it, top to bottom: the Canvas strip, the drawing area, the Progress bar as a footer. The Progress bar and the Canvas strip keep their specs; nothing sits below the canvas box any more.
- **The pill floats over the drawing area**, `pill-gap` (6px) in from the drawing area's edge on the side it is docked to, centred along that edge. The drawing runs behind it: the pill takes no width or height from the canvas. It never covers the Canvas strip or the Progress bar.
- **Four positions:** left, top, right, bottom (default: bottom, just above the Progress bar). On left or right the pill is vertical and its contents run top to bottom.
- **Length:** as long as its content. If that is longer than the edge (a phone, top or bottom), the recents drop away first, then the tools between Paint and the colour control scroll with no scrollbar (On a phone, below).
- **Stacking:** on the canvas overlay layer (`z-canvas-overlay`), above the beads, the Frame and the Selection bar's anchor, below toasts, sheets and modals.

## The pill

- **Material:** `elevated` fill, 1px `line` border, `elevation-2`, `radius-full`; `pill-thickness` (48px) across: 40px tiles in 4px padding, 2px between tiles.
- **Order, leading end first:** the grip, `Paint | Fill | Select | Eraser | Hand | Piece`, then the **Mirror** tile (the `mirror` icon; not a tool but a mode, ADR 0082), then, only while the clipboard holds something, a **Paste** tile (the `paste` icon; it enters paste mode and stamps nothing, and is the lit tile while paste mode is on, ticket 447), a divider, then the colour control. **A tile's key is its place in the pill** (ADR 0084): `Paint 1 · Fill 2 · Select 3 · Eraser 4 · Hand 5 · Piece 6 · Mirror 7 · Paste 8`, from one ordered list that the keys, the digit badges and the Keyboard shortcuts dialog all read, so they never disagree and the badges never skip (ticket 0461); a tile added later takes the next digit. Paste keeps `8` while it is hidden. Nothing follows it: the pill holds only tools and the colour control (ticket 0443). On left or right the leading end is the top.
- **Grip:** an 18 × 40px handle (40 × 18px when vertical) drawing a 4 × 22px `line-strong` bar, `radius-full`. It says "this moves" without a hint. With a mouse the whole pill can be dragged; the grip is where the cursor is `grab`. A finger or pen drags it by the grip only (On a phone, below).
- **Tool tiles:** 40px, `radius-lg`, 22px icon in `muted`; hover `hover-fill` and `ink`, pressed `press-fill`. The active tool sits on `panel` with its icon in `accent`. Each tile keeps its hotkey digit (1 to 8, its place in the pill) in the top-right corner, `meta-tiny`, `muted`, `accent-strong` on the active tile; the digits follow the hotkey-chip rule (tickets 438, 0846), so a device led by touch (an iPad, its Pencil too) hides them until a real key is pressed, in the editor and the Homepage demo alike. The digit is drawn on its chip, not written: it is a hint, not part of the tile's name, which stays the tool's word (ScreenReaders card, ticket 0856). Each tile's Tooltip has a line saying what the tool does (ticket 0844): Paint "Tap or drag to place beads in the chosen color.", Fill "Tap an area to fill it with the chosen color.", Eraser "Drag over beads to remove them." **While Pick color from canvas waits for a bead no tool tile is active**, Paint included: the eyedropper is not a tool, and the next press picks instead of drawing (ticket 0845; PaletteSwatches card).
- **The Mirror tile** (ticket 0750): Tooltip "Mirror", key `7`, line "Drag an area to mirror inside" («Выделите область, чтобы отражать внутри неё»); `aria-pressed` while the Mirror is on. **Lit while the Mirror is on** (the active tool's look: `panel` fill, icon and digit in `accent` / `accent-strong`), whatever tool is active, beside the lit drawing tool: the tile says the mode, not the tool. A press (or `7`) enters **Mirror mode**, the pick where a Canvas drag makes the Area (ContextBar card, Mirror bar); while in the pick, a Paint, Fill, Eraser or Paste press (or its key) leaves it and the Mirror stays on, and Escape with nothing dragged falls to Paint. It opens no popover. A press while the pick is on and nothing has been dragged leaves the pick, as Escape does. **Once its drag has made the Area the pick ends and the tool lit before it is lit again** (Paint, most often), so the next stroke paints mirrored (ticket 0845). On touch, entering the pick while the Mirror has no Area says what to do in a toast (ContextBar card, Mirror mode).
- **Dividers:** 1px `line-soft`, 24px long, 4px margin, across the pill's length.
- **Pen/Mouse is not on the pill (ticket 0443, spec 0440).** It is the Input row in Menu, shown once a pen has been seen (MenuPanel card). The `pen-mode` / `pen-mode-off` icons stay in the set.
- **Phones under 400px**, top or bottom: tiles stay 40px and the tools between Paint and the colour control scroll rather than shrinking (On a phone, below).
- **No Project open:** New Project and Import sit under the EmptyCanvas message and there is no pill.

## On a phone (ticket 0837)

- **Paint and the colour control stay in view.** When the pill is longer than its edge (a phone upright, 390px, top or bottom), the grip and Paint stay whole at its leading end and the divider and the colour tile at its trailing end, each tappable; only the tiles between them (Fill to Mirror, and Paste while it shows) scroll along the pill's length, with no scrollbar. The recents have already dropped away (Colour control).
- **The cut end fades.** The scrolling tiles fade out over `--pill-fade` (24px) at each end where a tile is cut, so the pill shows the tools go on: at first the trailing end; scrolled to the last tile, only the leading end. Docked left or right the same holds top to bottom.
- **A swipe scrolls, the grip moves.** A finger or pen moves the pill only from its grip; a swipe along the tiles scrolls them. A mouse still drags the whole pill (Moving the pill).
- **Tablets and laptops are unchanged:** where the whole pill fits along its edge nothing scrolls and nothing fades.

## Colour control

- **The tile:** one 40px tile where the `palette` icon is the swatch (ticket 0829): the icon at 28px, its body filled with the chosen colour and outlined in `ink` at the neighbouring icons' weight (1.4 on the 24 grid at this size), its four dabs in the mark that reads on the colour (`swatch-mark-dark` or `swatch-mark-light`). No circle and no ring: the palette shape is what tells the tile from the round recents beside it, and the `ink` outline keeps a white or black colour visible in every theme. With no colour chosen the body is empty and the whole icon is `muted`, like a tool's. Tap: opens the colour popover. The pill's length never changes.
- **Recents:** after the swatch tile, the three colours used before it as 18px round swatches with an inset 1px `field-line` ring (so Black shows on the dark pill, ticket 0865) on 30px-long tiles (30px tall when vertical). They stay in their slots in the popover's Palette grid too, ringed there (PaletteSwatches card). A recent swatch picks that colour at once (Shift+1, 2 and 3 do the same for the first, second and third, named "Recent 1" to "Recent 3" in the tooltip and the accessible name); the palette-shaped swatch tile opens the popover. A pick moves the colour to the front of the recents (eight kept, on the device). Only while there is room: if the whole pill would be longer than its edge (a phone upright, a short window), the recents drop away and only the swatch tile stays, and they return when there is room again.
- No key opens the colour control; the swatch tile's accessible name is "Color, <colour name>" with `aria-expanded`.

## Colour popover

Replaces the Colour sheet on every device, phones included.

- `--popover-width` (288px) wide, `--pill-popover-radius` (24px) corners, `overlay-fill`, 1px `overlay-line`, `elevation-3`, padding 12px 14px 14px, 12px between sections.
- **Wide while the Bead's palette is open** (ticket 0745): opening "Palette {bead}" (BeadColors card) widens the popover to `--popover-width-wide` (520px, the `panel-width`), no wider than the screen less `float-edge` at each side; closing it, or closing the popover, brings back 288px. The width changes at once, with no motion, and the popover is placed and clamped again as when it opens, so it stays beside the pill and on the screen. Its other contents stay as they are; the Palette grid fills the width with swatches of the usual size (PaletteSwatches card). The BeadColors list inside lays itself out by its own width, so where the screen leaves less than about 520px (a phone) it keeps its narrow layout.
- **Placement:** beside the pill toward the canvas, `pill-gap` away, centred on the tile that opened it and clamped `float-edge` inside the screen. It never sits under the pill or off-screen. It is drawn in the app shell at `z-popover`, not in the canvas box, so the box's clipping and its bars (the Progress bar) never cover it, and a dialog opened from it still covers it (ticket 0726); no taller than the screen less `float-edge` at each end, it scrolls when what opens inside it (the Custom color picker) leaves no room. Opens with the pop motion (`duration-slow`, `ease-out`, from 94% scale), none under reduced motion.
- **Contents, top to bottom:** a head (the chosen colour as a 20px `radius-sm` swatch, its name, its hex in `meta-small` `muted`, the **Edit Palette** pencil, Close); "palette" (in Edit Palette followed by the **Remove all** bin), the PaletteSwatches grid (every colour in its own slot, the pill's three recents included and ringed in `field-line`, ticket 0865; no recents row here) with Pick color from canvas as its last tile; then Custom and Image colors side by side (ColorPickers).
- **Its body is one component** (ticket 0758, `ColorPopoverBody`): the head with the chosen colour, then the Palette with Pick color, Custom color and the Bead's palette. Convert image's Change picker (FoundColorRow card) shows the same body in a row, with Keep exact added to its head.
- Picking a colour chooses it and closes the popover; Escape, Close, or a press outside close it too, and a press outside only closes.
- **Keyboard (ticket 0857):** opened from the keyboard (Enter or Space on the tile), focus goes to the chosen swatch, or the first where the chosen colour is not in the grid; the arrows, Home and End move among the swatches (the Palette's one Tab stop), Enter chooses. Choosing, Escape or Close gives focus back to the colour tile. Opened by a pointer, focus stays where it was. While the popover is open the tile shows no Tooltip, so nothing covers the popover's head.

## Moving the pill

- **Drag:** after 8px of movement the pill lifts (`elevation-3`-like shadow), follows the pointer, and four dashed `line-strong` drop zones show inside the drawing area; the nearest edge's zone turns `accent` with a 14% `accent` wash. Let go and the pill snaps there (`duration-slow`, `ease-standard`). Open popovers close when a drag starts. A drag never paints.
- **Keyboard and screen readers:** the grip is a focusable button, "Move tools", whose arrow keys move the pill to that edge; Menu also has "Tools position": Left | Top | Right | Bottom, under Preferences (MenuPanel card).
- The position is remembered on this device, like the theme (ADR 0020).

## Accessibility

- The pill is a `toolbar` named "Tools"; arrow keys move along it, Tab leaves it.
- Every tile has a `touch-target` hit area on coarse pointers; tiles and swatches stay apart by their gaps.
- On a busy Canvas colour the pill's border and shadow separate it; in high contrast it takes the 1px `line-strong` border.

Hand-written from the Tool pill proposal (2026-10-16); static rendition.

### Edit Palette in the head and the "palette" label (ticket 0531)

- **Pencil:** a plain 16px `IconButton` with the `pencil` icon, between the hex and Close, the same look as Close (`muted`, `hover-fill`, `ink` on hover). Shown only while the Palette has an added color. Tip "Edit Palette" («Изменить палитру»); in the mode its tip is "Done editing" («Готово»), it is `aria-pressed="true"` and shows its icon in `accent` with `press-fill`, like the Pen/Mouse toggle. Pressing it again leaves the mode. What the mode does to the swatches is in the PaletteSwatches card.
- **Remove all:** only in the mode, a plain 16px `IconButton` with the `delete` bin icon, 6px after the word "palette" on the same line (the label keeps `meta-small` `muted`). Tip "Remove all custom colors" («Убрать все свои цвета»). It asks first (PaletteSwatches card). With no added color left the mode ends, so it never shows disabled.
