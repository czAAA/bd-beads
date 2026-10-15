# CanvasStrip

The 46px header strip at the top of the canvas box: the canvas's own controls, right-aligned, and the Canvas color picker last. It names nothing (ticket 425, ADR 0055).

- The canvas box: `box` fill, 1px `box-line`, radius-lg, `elevation-2` (light only), overflow hidden; it takes all the width right of the left column.
- Strip: padding 0 10 0 16, gap 8, bottom divider `box-muted` at 22%, content right-aligned.
- **No title, size line, printed-size estimate, grid icon or keyboard-focus hint** (ticket 425 removed them; before it the strip read "Canvas · 3 pieces · no Frame" or "Pattern · Width 21 · Height 19 · 3.4 × 3.0 cm"). The Project's size lives in the Project sheet and the Frame's size tooltip.
- **Controls, in this order:** the Rulers toggle, Undo, Redo, zoom out, the zoom level, zoom in, Fit, then the Canvas color button. Rulers, Undo and Redo show only with a Project open (not while a picture is framed); with nothing open the strip is empty. The level is DM Mono `type-meta`, 48px wide and centered so the buttons don't shift. Zoom runs 10% to 400% in 10% steps; the tier's smallest-bead floor wins where it is higher. Icon buttons 30px (44px on a coarse pointer), 18px icons, radius-sm, no fill.
- **At every width, phones included.** When the strip is too narrow for the cluster it scrolls sideways (no visible scrollbar) and the buttons are never squeezed; Canvas color stays beside it.
- **Convert image framing:** the strip keeps only its own zoom (out, level, in, Fit) over the framing step's 100–800% range, since that zoom moves the picture under the fixed frame.
- **Rulers toggle:** the `ruler` icon; pressed is an `ink` fill with a `canvas` icon. Name "Rulers", `aria-pressed`. Shortcut `R`.
- **Canvas color button:** 30px, a 16px round dot showing the current background with a 1.5px `field-line` ring (so near-white stays visible). Name "Canvas color" with its own Tooltip, `aria-haspopup`, `aria-expanded`. It is the shared MenuButton (ticket 338) in its popover form, with the dot as its face. Every other button is a control-registry icon button, so its Tooltip carries the key chip (`R`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+−`, `Ctrl/Cmd++`, `Ctrl/Cmd+0`) and says why it is disabled. The picker opens the five-swatch picker (see CanvasBackground). In the high-contrast theme, where every choice is white, the popover holds the Dots | Squares choice alone.
- The Zoom pill (a draggable pill with the same buttons, ticket 79) is gone; its buttons moved here.

Hand-written from DESIGN.md §4.3, the v16 sign-off and ADR 0055.
