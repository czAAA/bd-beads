# 187: Export: page-locator grid on chart pages, horizontal past 16 pages

**What to build:** Add a small page-locator grid to each chart/block page produced by #185's 100×100-bead block chunking: a grid of squares matching the pattern's block layout, with the current page's block filled in and the rest left empty, so the weaver can see where the current printed page sits within the whole pattern. When the pattern splits into more than 16 blocks, lay the locator out as a horizontal strip instead of following the pattern's own (possibly tall) block-grid shape, so it doesn't add extra height below the pattern render.

**Blocked by:** 185 (Export: fixed 100×100-bead block chart pages — the locator's shape comes from that block grid)

**Status:** ready-for-agent

- [ ] Each chart/block page shows a small locator grid of squares, one per block, matching the pattern's block-grid layout
- [ ] The current page's block is visually filled/highlighted; all others are empty
- [ ] For patterns splitting into 16 or fewer blocks, the locator keeps the block grid's actual row/column shape
- [ ] For patterns splitting into more than 16 blocks, the locator switches to a horizontal strip layout instead of the tall block-grid shape
- [ ] Locator doesn't push the pattern render down or cause page overflow
