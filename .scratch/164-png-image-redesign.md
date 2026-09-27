# 164: PNG image redesign

**What to build:** The PNG image follows `printed-output.md` and the PngExport card: the whole Pattern on its board with rulers every 10 and the 10-bead lines takes about three quarters of the picture, and the rest tells the story (name, technique, maker's name, Beads needed with beads and grams, the total both ways such as "4 800 beads · ≈ 24 g"). A wide Pattern puts the story under the chart.

**Blocked by:** 162

**Status:** done

- [x] Matches the PngExport card for a typical Pattern and the PrintWide layout for a wide one
- [x] Uses the light values and the shared print pieces from ticket 162
- [x] The maker's name is left out when empty
- [x] Large Patterns export within today's limits; tests are updated

**Done (ticket 164):** `exportPatternPng` (`rendering/patternExport.ts`) now takes the same `PrintText` words the PDF does (`App.vue` builds it the same way, so the two agree) and draws a story column beside the chart, or under it for a Pattern wider than tall (`rendering/pngPage.ts`'s `pngLayout`/`drawPngStory`, new). The chart itself gained rulers every 10 and the 10-bead lines (`printPages.ts`'s `drawRulers`, now exported and reused directly) and a rounded board (a canvas clip, since the streamed picture can't afford a whole extra tile canvas); the low-level pieces ticket 162 built for the PDF — `text`, `wrap`, `font`/`pt`, `drawMark`, `drawAccentLine`, `drawBackgroundName`, `SANS`/`MONO`/`SERIF` — are now exported from `printPages.ts` and reused as-is, so the picture and the PDF read alike. The story's own height (for a Pattern with many colors) is measured with a throwaway canvas before the real one is sized — `pngLayout` and the real per-band draw both go through the same `drawStory`, so they can't drift — and rounded to whole px, which the streamed PNG encoder needs exactly (a fractional width or height desyncs its row math from the declared image size; found by decoding an export with Node's zlib directly, since Chromium's own decoder is lenient about it). `pngZoom`'s pixel budget now reserves room for the story before solving for the chart's own zoom, so a 250×250 Pattern's PNG (chart + story together) still keeps to `PNG_MAX_PIXELS`. `PNG_MARGIN_PX` grew from 24 to 40 px to leave room for the new rulers. Covered by five new browser cases in `e2e/visual/export.spec.ts` (a wide-vs-beside layout, the pixel budget re-checked against the real chart geometry, the maker's name present and absent) and checked visually by exporting real PNGs.
