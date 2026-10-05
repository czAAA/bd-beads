# CanvasStrip

The 46px header strip at the top of the canvas box: what is on the canvas, whether rulers show, which background the drawing area has, and a zoom cluster.

- The canvas box: `box` fill, 1px `box-line`, radius-lg, `elevation-2` (light only), overflow hidden; it takes all the width right of the left column.
- Strip: padding 0 10 0 16, gap 12, bottom divider `box-muted` at 22%.
- **No Frame (v16):** grid icon + "Canvas" (`control`), then "3 pieces · no Frame" (`meta` in `box-muted`); while the Frame is being set it reads "3 pieces · setting Frame".
- **Frame set:** grid icon + "Pattern", "21 columns · 19 rows · 3.4 × 3.0 cm". The app does not count pieces outside the Frame (ticket 259 removed it), so there is no divider and no count.
- Right-aligned: the Rulers toggle, the Canvas color button, zoom out, Fit, zoom in, in that order and with no level readout (ticket 215: the percentage is not shown; the smallest zoom is 50%). Icon buttons 30px, radius-sm, no fill.
- **Rulers toggle:** the `ruler` icon; pressed is an `ink` fill with a `canvas` icon. Name "Rulers", `aria-pressed`. Shortcut `R`.
- **Canvas color button:** 30px, a 16px round dot showing the current background with a 1.5px `field-line` ring (so near-white stays visible). Name "Canvas color", `aria-haspopup`, `aria-expanded`. It opens the five-swatch picker (see CanvasBackground). It is hidden in the high-contrast theme, where every choice is white.

Hand-written from DESIGN.md §4.3 and the v16 sign-off; static rendition.
