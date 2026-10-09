# CanvasStrip

The 46px header strip at the top of the canvas box: what is on the canvas, whether rulers show, which background the drawing area has, and a zoom cluster.

- The canvas box: `box` fill, 1px `box-line`, radius-lg, `elevation-2` (light only), overflow hidden; it takes all the width right of the left column.
- Strip: padding 0 10 0 16, gap 12, bottom divider `box-muted` at 22%.
- **No Frame (v16):** grid icon + "Canvas" (`control`), then "3 pieces · no Frame" (`meta` in `box-muted`); while the Frame is being set it reads "3 pieces · setting Frame".
- **Frame set:** grid icon + "Pattern", "21 columns · 19 rows · 3.4 × 3.0 cm". The app does not count pieces outside the Frame (ticket 259 removed it), so there is no divider and no count.
- **Narrow strip (ticket 315):** the size line never clips. Below 800px of strip width the printed-size estimate ("· 3.4 × 3.0 cm") is hidden; below 700px the grid icon is hidden too and the title and size line sit 10px closer. At 1024px the strip is about 630px wide, so both apply there. The strip's title, size and hint still truncate with an ellipsis as a last resort, and the zoom cluster never shrinks.
- Right-aligned: the Rulers toggle, the Canvas color button, zoom out, the zoom level, zoom in, then Fit, in that order (ticket 287; the level is DM Mono `type-meta`, 48px wide and centered so the buttons don't shift). Zoom runs 10% to 400% in 10% steps; the tier's smallest-bead floor wins where it is higher. Icon buttons 30px, radius-sm, no fill.
- **Rulers toggle:** the `ruler` icon; pressed is an `ink` fill with a `canvas` icon. Name "Rulers", `aria-pressed`. Shortcut `R`.
- **Canvas color button:** 30px, a 16px round dot showing the current background with a 1.5px `field-line` ring (so near-white stays visible). Name "Canvas color" with its own Tooltip, `aria-haspopup`, `aria-expanded`. It is the shared MenuButton (ticket 338) in its popover form, with the dot as its face. The Rulers and zoom buttons are control-registry icon buttons, so their Tooltips carry the key chip (`R`, `Ctrl/Cmd+−`, `Ctrl/Cmd++`, `Ctrl/Cmd+0`). It opens the five-swatch picker (see CanvasBackground). In the high-contrast theme, where every choice is white, the popover holds the Dots | Squares choice alone.

Hand-written from DESIGN.md §4.3 and the v16 sign-off; static rendition.
