# CanvasStrip

The 46px header strip at the top of the canvas box: what the Pattern is and how far it is zoomed.

- The canvas box: `box` fill, 1px `box-line`, radius-lg, `elevation-2` (light only), overflow hidden; it takes all the width right of the left column.
- Strip: padding 0 10 0 16, gap 12, bottom divider `box-muted` at 22%.
- Grid icon + "Pattern" (`control`), "40 columns · 30 rows" (`meta` in `box-muted`), then zoom right-aligned: zoom out, "100%" (DM Mono 13, 48px wide, centered), zoom in, reset to fit. Icon buttons 30px, radius-sm, no fill.

Hand-written from DESIGN.md §4.3; static rendition.
