# 185: Export: fixed 100×100-bead block chart pages

**What to build:** Change chart-page splitting (#163) from an auto-computed part size to fixed 100×100-bead blocks, one block per page.

**Blocked by:** 184 (Fix huge-pattern export first-page scaling regression — shares the same pagination sizing logic)

**Status:** done

- [x] Chart pages split a pattern into 100×100-bead blocks (edge blocks sized to whatever remains)
- [x] Each block renders on its own page
- [x] Verified against both the previous auto-computed behavior's test fixtures and new large-pattern fixtures

**Done (ticket 185):** `planPrint` (`src/rendering/printPlan.ts`) used to compute how many beads fit a page at the 4.6 mm base bead (`fits()`), then split evenly into that many parts. It now takes a fixed `PRINT_BLOCK_BEADS` (100) a side — `partAcross`/`partDown` are simply `min(100, grid.across/down)` — and edge blocks are whatever remains, not re-divided evenly. A Pattern that fits one block (up to 100×100 beads) now needs no split at all: a 60×80 Pattern that used to take 4 chart pages at ≥4.6 mm now takes 1, at whatever bead size fills the page (no longer floored at the base size — that floor came from the old part-count search, which this ticket replaces). PrintStrips (the bracelet multi-part-per-sheet case) is unchanged apart from receiving the fixed block width instead of a computed one; its own "less than half a page" guard still decides whether to stack.

`printPlan.test.ts` was rewritten where the old fixed-size assumptions no longer hold (the 60×80 and PrintWide cases) and gained a dedicated 100×100-block test for a 250×250 Pattern (3×3 blocks, 9 pages, edge blocks correctly sized). The existing "covers every bead" and PrintStrips tests needed no changes — they don't assume a particular block size.

`npm run typecheck`, `vitest run` and `npm run lint` are clean.
