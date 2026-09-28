# 187: Export: page-locator grid on chart pages, horizontal past 16 pages

**What to build:** Add a small page-locator grid to each chart/block page produced by #185's 100×100-bead block chunking: a grid of squares matching the pattern's block layout, with the current page's block filled in and the rest left empty, so the weaver can see where the current printed page sits within the whole pattern. When the pattern splits into more than 16 blocks, lay the locator out as a horizontal strip instead of following the pattern's own (possibly tall) block-grid shape, so it doesn't add extra height below the pattern render.

**Blocked by:** 185 (Export: fixed 100×100-bead block chart pages — the locator's shape comes from that block grid)

**Status:** done

- [x] Each chart/block page shows a small locator grid of squares, one per block, matching the pattern's block-grid layout
- [x] The current page's block is visually filled/highlighted; all others are empty
- [x] For patterns splitting into 16 or fewer blocks, the locator keeps the block grid's actual row/column shape
- [x] For patterns splitting into more than 16 blocks, the locator switches to a horizontal strip layout instead of the tall block-grid shape
- [x] Locator doesn't push the pattern render down or cause page overflow

**Done (ticket 187):** `drawMiniMap` (`src/rendering/printPages.ts`, `drawSinglePartPage`'s header) already drew a locator grid the shape of the block grid; it didn't yet have the >16-block horizontal-strip fallback this ticket asks for. Its geometry moved into a new pure function, `miniMapLayout`, that `drawMiniMap` now just draws from: past `MINI_MAP_GRID_LIMIT` (16) total blocks it lays every block out in a single row instead of the grid's own rows/columns, capped to a fixed width budget so it stays a locator strip rather than growing with the block count. Kept as a pure function specifically so the layout choice (which cell is "here", grid vs. strip, cell size) is unit-testable without a canvas — `printPages.test.ts` covers both a ≤16-block Pattern (keeps the actual row/column shape) and a >16-block one (single row, no added height). PrintStrips sheets (the bracelet case) don't use a mini-map at all, unaffected by this ticket, same as before.

`npm run typecheck`, `vitest run` and `npm run lint` are clean.
