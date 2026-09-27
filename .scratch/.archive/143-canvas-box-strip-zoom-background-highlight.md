# 143: Canvas box: header strip, zoom, background highlight

**What to build:** The canvas box follows the `CanvasStrip`, `ZoomPill` and `BeadBoard` cards: a 46px header strip (grid icon, "Pattern", "40 columns · 30 rows", and the zoom out / 100% / zoom in / fit-to-view controls right-aligned), then the drawing area holding the rulers and board, with the open Pattern's Technique shown as a large faint Instrument Serif italic word bottom-right and one soft curve sweeping behind. Both are decoration only: hidden from assistive tech, not interactive, and never in exports.

**Blocked by:** 140, 141, 157

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: CanvasStrip, BeadBoard.

- [x] The strip, dividers (`--box-muted` at 22%), spacing and 30px icon buttons match the `CanvasStrip` card; the zoom controls move here from where they are now and behave the same
- [x] At "fit" the board fills the area with about 36px spare left/right and 18px top/bottom; zoom scales from there
- [x] The word and curve use `--word` and `--curve`, sit behind the board, are fainter in dark, and never appear in PNG, PDF or QR exports
- [x] The box is `--box` with a 1px `--box-line`, radius 12, elevation 2 in light only, and clips its contents
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [x] Existing zoom, fit and pan behaviors and tests pass

**Done (ticket 143):** the Progress bar still sits in the drawing area above or beside the Pattern until ticket 144 moves it along the box's bottom edge. The rulers stay on all four sides of the board (the card shows top and left only); ticket 159's keyboard and screen-reader work may revisit that.
