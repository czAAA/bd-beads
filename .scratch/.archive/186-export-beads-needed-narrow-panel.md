# 186: Export: narrow Beads-needed panel on page 1

**What to build:** Make the Beads-needed section on export page 1 a narrow rectangle instead of a wide block, freeing space for more information on the first page.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Beads-needed panel on page 1 uses a narrow layout with no dead space
- [x] Additional page-1 content fills the reclaimed space
- [x] No information from the current Beads-needed panel is lost, just laid out narrower

**Done (ticket 186):** `drawBeadsNeeded` (`src/rendering/printPages.ts`) used to stretch its color-row height to whatever vertical room was left below it (`bottom - y`), which for a wide Pattern's below-legend layout was most of the remaining page — a wide, sparse-looking block. The maker/technique/bead/size facts that used to run on underneath it now live in their own function, `drawFacts`, in a second narrow column beside `drawBeadsNeeded` rather than stacked under it; `drawBeadsNeeded` itself now uses a fixed, legible row height (5.5 mm, or 4.2 mm past 20 colors) instead of stretching. In the side-legend layout there's no room for a second column in the margin, so the two stay stacked as before (unchanged there). In the below-legend layout (now only genuinely wide Patterns, after #184's fix), the two columns sit side by side, using the width that used to go unused next to a narrow block.

`npm run typecheck`, `vitest run` and `npm run lint` are clean; the existing `patternExport.test.ts`/`printPages.test.ts` coverage of page 1 layout still passes with the narrower panel.
