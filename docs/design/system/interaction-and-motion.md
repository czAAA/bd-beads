# Interaction and motion

How every control answers the pointer, the finger and the keyboard, and how things move.

## Interaction states

- **Hover** exists only with a mouse or trackpad (`@media (hover: hover)`). It is one step of fill: `--hover-fill` (`surface` in light, `elevated` in dark). Primary buttons go to `accent-hover` (lighter orange in light, keeping the dark label); fields and in-box buttons darken their border instead; tool tabs and segments brighten their text to `ink`; links underline; Saved Pattern thumbnails show their Remove ×.
- **Pressed** is one more step (`--press-fill`: `line` in light, `line-strong` in dark) plus a slight shrink (98% for buttons, 92–94% for swatches and Dock buttons) for `--duration-instant`. On touch it is the only feedback there is, so it is never skipped.
- **Focus** (`:focus-visible`, keyboard only) is the 2px `focus-ring` (neutral: `ink`, black in light and white in dark), just inside the control's edge (3px black in high contrast), so it never reads as the yellow or orange of "selected" (ADR 0075), on every interactive element; fields also take an `ink` border. It is never removed and never replaced by a colour change alone.
- **Disabled** is `faint` text and icons, no hover, no press, `cursor: not-allowed`; primary uses `accent-disabled-bg` / `accent-disabled-fg`. The reason is written nearby.
- **Selected** uses the colour of its kind: `accent-strong` for the active tool and the open Saved Pattern, the `ring` for swatches, an `ink` fill for segments and the theme toggle, `panel` for the Dock button whose sheet is open.
- **On the Pattern**: a hovered bead shows the 2px `bead-outline` (no colour chosen) or the chosen colour at 60% (Paint). The pointer is a bead-shaped marker over the board (90% of a bead less 1px, see BeadHover), grab while Space is held, grabbing while panning. Painting has no animation.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-instant` | 80ms | Press feedback, bead hover |
| `--duration-fast` | 120ms | Hover and colour changes, tooltips |
| `--duration-base` | 200ms | Menus, popovers, toasts, modals, disclosure rows, the row marker (leaving: 150ms) |
| `--duration-slow` | 280ms | Sheets arriving (leaving: 200ms) |
| `--ease-out` | cubic-bezier(.2,.8,.2,1) | Arriving |
| `--ease-in` | cubic-bezier(.4,0,1,1) | Leaving |
| `--ease-standard` | cubic-bezier(.2,0,0,1) | Moving between places |

The motion tokens are CSS custom properties in `components/bundle.css`: the design-system format has no motion family.

- Only `transform` and `opacity` animate over the canvas: sheets, menus, toasts and modals move over it, and the drawing surface never resizes during an animation (ADR 0018). Height animates only inside the left column.
- Things arrive with `--ease-out` and leave with `--ease-in`, a little faster than they came. Nothing bounces or overshoots.
- Row done is the one motion on the Pattern, because it confirms the most repeated action: the finished pass's beads glint one after another, the current-pass rings and their ruler pill glide to the next pass, and the track grows with a spark riding its edge. The press that marks the last pass also plays Pattern done, once. Row progress, below, has every value.
- No motion for painting, the theme switch (colours change at once so the canvas redraws once) or zoom steps; pinch follows the fingers directly.
- The Homepage's rolling slogan is the one motion that runs by itself, apart from Pattern done, which plays once after the press that marks the last pass: each accent word holds `--slogan-hold` (2.2s), then rolls down out of view as the next drops in from above over `--slogan-roll` (650ms) with `--ease-standard`, `transform` only. It pauses while the page is hidden (Homepage card). Its sections turn as the page scrolls (ticket 0739): the old one slides up `--section-shift` and fades as the next rises in, over `--section-turn` (600ms) on `--ease-standard`; the free list's roll falls with a little bounce and rolls back up.
- Toasts leave after 5s unless hovered or focused; errors stay until closed.
- **Reduced motion** (`prefers-reduced-motion: reduce`): nothing slides or scales. Sheets, menus and modals fade in 120ms, the row marker and the ruler pill jump, the finished pass does not glint, the track spark does not flare, Pattern done does not play (the finished passes just show at full color), the loading beads stand still, the Homepage slogan stays on "openbeads", its sections swap without sliding and its free list's roll appears without falling. Colour and opacity feedback stay.

## Open canvas and Frame (v16)

- **Moving the canvas** follows the pointer or the wheel directly, with no easing and no inertia of its own (the device's own scroll inertia is kept). Space + drag shows the grab cursor, and the grabbing cursor while dragging; the Hand tool shows its Tool pointer, `hand`, and `hand-grabbing` while dragging (`assets/Cursors/`, ticket 0542). A hovering Apple Pencil gets no CSS cursor from Safari, so the app draws the same Tool pointer (and the eyedropper's) at the Pencil's tip while it hovers: hidden on contact, lift, cancel and leave, the Hand's open hand for a Pencil that moves the canvas (Mouse mode), nothing over the Frame's margin or in Set Frame (ticket 546).
- **Zoom** (⌘ or Ctrl + wheel, pinch, ⌘ or Ctrl + plus, minus and 0, the strip's buttons) is Canvas zoom, the only zoom: Page zoom is locked (ADR 0034), so a pinch, double-tap or ⌘ or Ctrl + wheel that starts outside the canvas does nothing, and one that drifts onto it stays inert. It keeps the point under the pointer still. It stops at the 10% Zoom floor on every screen.
- **Set Frame:** the Frame follows the drag and snaps to whole beads with no animation; its size tag updates as it moves.
- **Bring into view** (the Frame number) scrolls the canvas over `--duration-base` with `--ease-out`; under reduced motion it jumps.
- **Margin:** its dashed outline fades in over `--duration-fast` while the Frame is set, moved or resized and after a refused press, and out again; opacity only. Beads moved out of it appear in their new place with no travel animation.
- **Rotate:** the Selection's beads turn at once, and the turned rectangle is the new Selection. Beads it covers are simply replaced, with no travel animation; the Message says how many and offers Undo.
- Rulers appear and hide at once. Nothing else on the Pattern animates: Row progress, below, is the only motion there.

## Row progress (ticket 0729)

Approved on the claude.ai design canvas "OpenBeads progress & done animations" (https://claude.ai/artifact/T4bQzgU9sWKBibYfjnLo5g): variant 6 in the Progress bar, variant 7 on the keep-out margin. The values are in `components/bundle.css` and `src/styles/design-values.css`, the spark and Pattern done classes (`.bb-spark`, `.bb-pattern-done-*`) in `bundle.css`.

**Row done** (the button or its key, in the Progress bar or on the margin sheet):

- **Glint:** each bead of the pass just finished is washed in `--row-glint` (white) from nothing to `--row-glint-peak` (55%) and back over `--row-glint-duration` (380ms, `--ease-out`), one bead after another in the Row direction, `--row-glint-step` (24ms) apart, the step shortened so the whole pass starts within `--row-glint-span` (480ms). On peyote only the beads that pass adds glint; a Custom frame's pass glints in its Row order. Nothing runs along the line: no thread, no band. The canvas draws it, as opacity only.
- **Then the dimming:** the pass takes the finished look (BeadBoard card) after `--row-dim-delay` (520ms), so the glint shows at full color.
- **Marker:** the current-pass rings move to the next pass and the ruler pill glides along the ruler over `--duration-base` with `--ease-standard` (Rulers card).
- **Track spark:** a round `--spark-core` dot, `--spark-size` across (10px; `--spark-size-compact`, 8px, on the margin's 64px track), with a `--spark-glow` halo, rides the fill's leading edge, its tail of `--spark-tail` (70px; `--spark-tail-compact`, 24px) fading back along the fill. The fill grows over `--duration-base` (`--ease-standard`, `transform` only) and the dot rides with it, flaring to `--spark-flare` (2.2 times) and back over `--spark-flare-duration` (520ms) while its tail stretches. Row not done moves it back with no flare. It is hidden before the first pass and stays at the end once every pass is done; nothing glows round the whole track.

**Pattern done:** `--pattern-done-delay` (450ms) after the press that marks the last pass, a layer over the Frame (inside its margin sheet) that takes no press and is hidden from screen readers plays:

1. **Firework:** three bursts in `--pattern-done-spark-1` to `--pattern-done-spark-4` (silver in dark), each ray with a `--pattern-done-glow` halo and a round head. Each burst opens with a flash at its core, a radial wash that grows and fades over 600ms. The first, at the Frame's centre, throws 20 long rays (900ms) and, from 160ms, 14 shorter ones (760ms); the second, `--pattern-done-burst-2` (420ms) later, up and to the left, and the third, `--pattern-done-burst-3` (760ms) later, up and to the right, each throw 14 short rays (760ms) and 10 shorter ones (620ms) 100ms after. The side bursts stand a third of the Frame's width out (290px at most) and a sixth of its height up. The rays fly out 150, 96 and 56 screen px, whatever the zoom, shrinking as they fade.
2. **Shimmer:** from `--pattern-done-shimmer-delay` (250ms) the finished passes fade from the finished look to full color over `--pattern-done-restore` (500ms) while one skewed band of `--pattern-done-shimmer-fill` sweeps across the Frame over `--pattern-done-shimmer` (1000ms, `--ease-standard`). They stay at full color while every pass is done; Row not done dims them again.
3. **Twinkle:** from `--pattern-done-stars-delay` (1100ms), 14 four-point stars (22px, every third 30px), in the same silvers with the `--pattern-done-glow` halo, light on beads spread across the Frame, `--pattern-done-star-step` (90ms) apart, each growing, turning 90° and fading over `--pattern-done-star` (900ms).

Pattern done is over in about 2.6s and leaves nothing behind. It plays only after a press that marks the last pass: never on opening a finished Project, on Undo or Redo, or when Row highlight is turned back on. Row not done, Reset progress, Undo, Remove Frame or leaving the Project stop it at once. It is never in exports. It moves by `transform` and `opacity` only, and nothing in it bounces.

**Themes:** dark is the approved look. Light swaps the silvers for pewter greys that read on the light Canvas colors, and the spark's halo for the orange of the light track. High contrast draws the firework and stars in `ink` with no halos and no shimmer, and the spark as a solid `ink` dot. Light and high contrast were checked on a canvas in ticket 0730 and kept as they are.

**Reduced motion:** no glint, no spark flare or tail, no firework, shimmer or stars. The pass takes the finished look at once, the marker and the ruler pill jump, and when the last pass is done the finished passes show at full color at once.

**As built (ticket 0730):**

- **The trigger** is the press: the Row progress flow records each press of Row done or Row not done that moves the pointer, and the Canvas plays from that record, so opening a Project, Undo, Redo and Reset progress play nothing. Turn row direction stops the motion too, as Row not done, Reset progress, Undo, Redo, Remove Frame and leaving the Project do.
- **On the canvas** a short frame loop runs while something moves and stops when nothing does. The glint is drawn on the overlay, over the pass's beads drawn again at full color until the dim delay; each bead's wash rises to the peak in the first 35% of its 380ms and falls back, each part eased out, as the prototype's keyframes. A second Row done while a glint plays keeps it going; Row not done ends it.
- **Full color once every pass is done** holds however the Project got there: a finished Project opens with its passes at full color. After the press that marks the last pass they keep the finished look until the shimmer starts, then the beads are drawn at full color under a copy of their dimmed drawing that fades out over `--pattern-done-restore` (opacity only; a pan or zoom meanwhile drops the copy).
- **Pattern done** plays until its last star ends, 1100 + 13 × 90 + 900 = 3170ms after it starts (3.6s after the press), so "about 2.6s" above is its firework and shimmer. The rays take the prototype's silvers per burst, every other ray 40ms later; the 14 stars light on the Frame's beads at the prototype's spots on its 16 × 10 Frame, scaled to the Frame's rows and columns. The four-point star is the prototype's path.
