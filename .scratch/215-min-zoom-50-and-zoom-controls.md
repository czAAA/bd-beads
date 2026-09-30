# 215: Minimum zoom 50%, hidden zoom level, reordered zoom buttons

**What to build:** The smallest zoom is 50% (was 25%), so the smallest bead is 10 × 10 CSS pixels (was 5 × 5). The zoom percentage is no longer shown on the page (the element stays in the DOM, hidden, for tests). The zoom buttons read minus, reset, plus, in both the canvas strip and the phone pill.

**Blocked by:** None (can start immediately)

**Status:** done

**Overview / Tour:** not asked yet; ask before adding to either.

- [x] `MIN_ZOOM` is 0.5; step and maximum unchanged
- [x] The zoom level is hidden in `ZoomControls` and `ZoomPill`
- [x] Button order is minus, reset, plus in both
- [x] Unit tests updated
- [ ] Visual specs now use 50% instead of 25%; the old `-25` baselines are removed, the `-50` baselines come from CI (`npm run visual:update`)
- [ ] The design system (ZoomPill, CanvasStrip) still shows the level and the old order; update it on claude.ai, then copy it in (DESIGN.md §6)
