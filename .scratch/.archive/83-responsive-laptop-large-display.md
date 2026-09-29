# 83: Responsive: 24″ and larger tier

**What to build:** The 24″ and larger tier from `docs/design/system/responsive.md` (1920px and up), and a check that the MacBook Air tier (1280–1919px, the reference layout) holds across its range. At 24″ the left column grows to 360px (344px boxes), page padding is 32/40 and the header padding 0 40. Beads needed shows 5 color rows and Saved Patterns 10 thumbnails before they need expanding. Type and controls keep their size: the extra space goes to the Pattern, never to bigger chrome.

**Blocked by:** 167 (Responsive: iPad 13″ tier and the breakpoint setup)

**Status:** done

**Note (performance plan, ADR 0018):** a larger canvas box means a larger Drawing surface to redraw. Check drawing, hover and painting at 2240px with ticket 103's performance check at the floor CPU slowdown (a Core i3 laptop is the reference), so the extra space does not cost the frame-rate targets.

- [x] At 1920, 2240, 2560 and 3840px wide the layout matches the tier description and the ScreenSizes card
- [x] At 1366, 1440, 1470 and 1710px wide the MacBook Air layout holds unchanged
- [x] Beads needed shows 5 rows and Saved Patterns 10 thumbnails before expanding at this tier
- [x] No regressions to the other tiers

**Done (ticket 83):** a `@media (min-width: 1920px)` tier in `AppShell.vue` (360px column, page padding 32/40, notices row 40) and `AppHeader.vue` (padding 0 40; `2.5rem` because there is no 40px spacing token). `BeadQuantities` and `PatternList` read `useMediaQuery('(min-width: 1920px)')` for 5 rows (`--panel-body-height-desktop`, 10rem) and 10 thumbnails (`--saved-body-height-desktop`, 12.5rem, an estimate for two thumbnail rows). Tests in `App.responsive.test.ts`, `BeadQuantities.test.ts`, `PatternList.test.ts`; typecheck, lint and the full suite (2032 tests) are clean.

**Human checks done:** the tier was checked in a real browser and ticket 103's performance check was run at 2240px.
