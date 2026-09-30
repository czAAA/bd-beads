# Interaction and motion

How every control answers the pointer, the finger and the keyboard, and how things move.

## Interaction states

- **Hover** exists only with a mouse or trackpad (`@media (hover: hover)`). It is one step of fill: `--hover-fill` (`surface` in light, `elevated` in dark). Primary buttons go to `accent-hover` (lighter orange in light, keeping the dark label); fields and in-box buttons darken their border instead; tool tabs and segments brighten their text to `ink`; links underline; Saved Pattern thumbnails show their Remove ×.
- **Pressed** is one more step (`--press-fill`: `line` in light, `line-strong` in dark) plus a slight shrink (98% for buttons, 92–94% for swatches and Dock buttons) for `--duration-instant`. On touch it is the only feedback there is, so it is never skipped.
- **Focus** (`:focus-visible`, keyboard only) is the 2px `focus-ring`, 2px away (3px in high contrast), on every interactive element; fields also take an `ink` border. It is never removed and never replaced by a colour change alone.
- **Disabled** is `faint` text and icons, no hover, no press, `cursor: not-allowed`; primary uses `accent-disabled-bg` / `accent-disabled-fg`. The reason is written nearby.
- **Selected** uses the colour of its kind: `accent-strong` for the active tool and the open Saved Pattern, the `ring` for swatches, an `ink` fill for segments and the theme toggle, `panel` for the Dock button whose sheet is open.
- **On the Pattern**: a hovered bead shows the 2px `bead-outline` (no colour chosen) or the chosen colour at 60% (Paint). The cursor is a crosshair over the board, grab while Space is held, grabbing while panning. Painting has no animation.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-instant` | 80ms | Press feedback, bead hover |
| `--duration-fast` | 120ms | Hover and colour changes, tooltips |
| `--duration-base` | 200ms | Menus, popovers, toasts, modals, disclosure rows, the row marker (leaving: 150ms) |
| `--duration-slow` | 280ms | Sheets and the Drawer arriving (leaving: 200ms) |
| `--ease-out` | cubic-bezier(.2,.8,.2,1) | Arriving |
| `--ease-in` | cubic-bezier(.4,0,1,1) | Leaving |
| `--ease-standard` | cubic-bezier(.2,0,0,1) | Moving between places |

The motion tokens are CSS custom properties in `components/bundle.css`: the design-system format has no motion family.

- Only `transform` and `opacity` animate over the canvas: sheets, the Drawer, menus, toasts and modals move over it, and the drawing surface never resizes during an animation (ADR 0018). Height animates only inside the left column.
- Things arrive with `--ease-out` and leave with `--ease-in`, a little faster than they came. Nothing bounces or overshoots.
- Row done glides the current-row marker to the next row and grows the progress line with it: the one motion on the Pattern, because it confirms the most repeated action.
- No motion for painting, the theme switch (colours change at once so the canvas redraws once) or zoom steps; pinch follows the fingers directly.
- Toasts leave after 5s unless hovered or focused; errors stay until closed.
- **Reduced motion** (`prefers-reduced-motion: reduce`): nothing slides or scales. Sheets, the Drawer, menus and modals fade in 120ms, the row marker jumps, the loading beads stand still. Colour and opacity feedback stay.

## The Tour (v15)

| Layer | Arrives | Leaves |
| --- | --- | --- |
| Dim layer | opacity, `--duration-base`, `--ease-out` | opacity, 150ms, `--ease-in` |
| Hole and gold highlight moving to the next control | `transform`, `--duration-base`, `--ease-standard` | |
| Grey dotted pointer | opacity, `--duration-fast`, after the card lands | at once, with the card |
| Step card | opacity and an 8px move toward the control, `--duration-base`, `--ease-out`; between steps `--ease-standard`, text cross-fades in `--duration-fast` | opacity, 150ms, `--ease-in` |

- The gold highlight stays on the control until it is pressed, then moves on; it never pulses. Under reduced motion every Tour layer fades in 120ms and the hole jumps.
- The dim layer blocks presses outside the holes and the card; wheel, trackpad pinch and two-finger touch over the canvas box still scroll and zoom the Pattern.
- The Overview's steam and carousel scroll animate only with reduced motion off; its drawings never move.
