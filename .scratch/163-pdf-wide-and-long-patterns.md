# 163: PDF for wide and long Patterns

**What to build:** Wide and long Patterns print well, as the PrintWide and PrintStrips cards describe: a Pattern wider than tall prints on landscape A4 with the same layout, and when a part would fill less than half a page (bracelets), several parts stack on one sheet, each on its own board with rulers and a label like "Part 2 · columns 39–76", at the base bead size.

**Blocked by:** 162

**Status:** done

- [x] Wider-than-tall Patterns print landscape; taller or square print portrait
- [x] Short parts stack on one sheet with their own boards, rulers and labels
- [x] Tests cover a wide Pattern, a bracelet-length Pattern and a square one

**Done (ticket 163):** `planPrint` (`rendering/printPlan.ts`) now picks `A4_LANDSCAPE` when the Pattern is wider than tall and `A4_PORTRAIT` otherwise (`orientedPage`/`isPatternWide`), same layout either way. When a split happens only one way (the other axis stays whole) and that whole axis would fill less than half its page at the base 4.6 mm bead, `planStrips` groups several parts onto shared sheets instead of one page each, still at the base size; `PrintPlan.strip` marks a plan built this way. `drawChartPage` (`rendering/printPages.ts`) now takes the group of parts sharing a page: one full-page board as before, or (`drawStripSheet`) several small boards stacked top to bottom, each with its own rulers and a "Part N · columns/rows A–B" label (`partColumns`/`partRows`, already worded in ticket 162) — the raw axis being split (columns unturned, rows turned), lowest number first. The page's footer keeps reporting where the chart goes on, from the last part on the sheet. `patternExport.ts` groups `plan.parts` by page number before drawing. Covered by `printPlan.test.ts` (a 96×24 wide Pattern landscape with two full pages, a 40×60/50×50 portrait check, and a 300×8 bracelet that stacks) and three new browser cases in `e2e/visual/export.spec.ts` exporting real PDFs (checked visually too: the bracelet's page 2 shows two stacked 50-column strips labeled "Часть 1 · столбцы 1–50" / "Часть 2 · столбцы 51–100", the wide Pattern's two chart pages each fill the landscape sheet, matching PrintWide's own 96×24 example exactly).
