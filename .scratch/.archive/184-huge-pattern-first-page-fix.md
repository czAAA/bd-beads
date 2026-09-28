# 184: Fix huge-pattern export first-page scaling regression

**What to build:** Fix exports of very large patterns so the first page always shows the full pattern scaled to fill the sheet, as originally specified in #162/#163, instead of a tiny centered image with wasted space.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Exporting a pattern large enough to previously reproduce the bug shows the full pattern filling page 1
- [x] No excess empty space around the page-1 image
- [x] Regression test/fixture added covering a large pattern size that previously failed

**Done (ticket 184):** `pageOneLayout` (`src/rendering/printPages.ts`) picked between the "beside" and "below" legend placements purely by whether the Pattern's displayed width exceeds its height. Peyote and brick stitch's row pitch (`rowPitchPx`, 0.75× the column pitch) makes even a square bead count come out technically wider than tall, so a large peyote or brick square was always routed into the below-legend layout — whose fixed `mm(78)` band fit it at zoom ≈ 0.08 instead of the ≈ 0.20 the side layout had room for, leaving a small, centered chart on an otherwise empty page. `pageOneLayout` now computes both layouts and keeps whichever draws the Pattern larger, which is a strict generalization: it never does worse than the old aspect-only choice and fixes the peyote/brick case. New tests in `printPages.test.ts` cover the previously-broken 250×250 peyote/brick/loom cases and confirm a genuinely wide Pattern still uses the below-legend layout.

`npm run typecheck`, `vitest run` and `npm run lint` are clean.
