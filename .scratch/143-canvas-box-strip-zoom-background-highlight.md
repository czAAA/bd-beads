# 143: Canvas box: header strip, zoom, background highlight

**What to build:** The canvas box follows `DESIGN.md` §4.3 and §4.4: a 46px header strip (grid icon, "Pattern", "40 columns · 30 rows", and the zoom out / 100% / zoom in / fit-to-view controls right-aligned), then the drawing area holding the rulers and board, with the open Pattern's Technique shown as a large faint Instrument Serif italic word bottom-right and one soft curve sweeping behind. Both are decoration only: hidden from assistive tech, not interactive, and never in exports.

**Blocked by:** 140, 141, 157

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: CanvasStrip, BeadBoard.

- [ ] The strip, dividers (`--box-muted` at 22%), spacing and 30px icon buttons match §4.3; the zoom controls move here from where they are now and behave the same
- [ ] At "fit" the board fills the area with about 36px spare left/right and 18px top/bottom; zoom scales from there
- [ ] The word and curve use `--word` and `--curve`, sit behind the board, are fainter in dark, and never appear in PNG, PDF or QR exports
- [ ] The box is `--box` with a 1px `--box-line`, radius 12, elevation 2 in light only, and clips its contents
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from `DESIGN.md` §3
- [ ] Correct in both the light and the dark theme
- [ ] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [ ] Existing zoom, fit and pan behaviors and tests pass
