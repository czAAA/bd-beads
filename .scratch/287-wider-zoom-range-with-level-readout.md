# 287: Wider zoom range, finer step, and the zoom level back on the strip

**What to build:** The canvas zooms from 10% to 400% (was 50% to 300%), in 10% steps (was 25%). The zoom level comes back between zoom out and zoom in, so the cluster reads `-  100%  +  [fit]`: zoom out, the level, zoom in, then Fit last. The level is currently hidden (ticket 143 left it in the markup, switched off). The same cluster applies on the strip and the phone's ZoomPill. The tier's smallest-bead floor (ticket 223) still wins over the 10% minimum where it is higher, so zooming out and Fit stop there as today. Update the local design system in the same change wherever it describes the old range, step, order or the hidden level (`DESIGN.md` §6): the `CanvasStrip` and `ZoomPill` cards (README and `preview.html`), the guideline files that mention the zoom range or controls, `bundle.css` and `src/styles/design-values.css` if the level's styling or width changes, plus a line in the README's Version changelog.

**Blocked by:** 284 (it rewrites the same zoom-cluster lines on the cards to say "no level readout"; land it first so this ticket replaces that text instead of conflicting with it)

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] Zoom minimum is 10%, maximum 400%, and zoom in and out move by 10%; wheel and pinch zoom clamp to the same range
- [ ] The level shows between zoom out and zoom in on the canvas strip and the ZoomPill, with the Fit button after zoom in; it stays readable and doesn't shift the buttons as it changes
- [ ] The smallest-bead floor still stops zoom out and Fit where it is higher than 10%
- [ ] Fit and the 100% opening zoom behave as before
- [ ] Design system cards, guideline files, tokens/CSS (if touched) and the README Version changelog match the new range, step, order and visible level, with no card still saying "no level readout"
- [ ] Tests that assume the old range or step (grid, canvas view, zoom controls) are updated and the related tests pass
