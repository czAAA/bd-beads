# 83: Responsive: 24″ and larger tier

**What to build:** The 24″ and larger tier from `docs/design/system/responsive.md` (1920px and up), and a check that the MacBook Air tier (1280–1919px, the reference layout) holds across its range. At 24″ the left column grows to 360px (344px boxes), page padding is 32/40 and the header padding 0 40. Beads needed shows 5 color rows and Saved Patterns 10 thumbnails before they need expanding. Type and controls keep their size: the extra space goes to the Pattern, never to bigger chrome.

**Blocked by:** 167 (Responsive: iPad 13″ tier and the breakpoint setup)

**Status:** ready-for-agent

**Note (performance plan, ADR 0018):** a larger canvas box means a larger Drawing surface to redraw. Check drawing, hover and painting at 2240px with ticket 103's performance check at the floor CPU slowdown (a Core i3 laptop is the reference), so the extra space does not cost the frame-rate targets.

- [ ] At 1920, 2240, 2560 and 3840px wide the layout matches the tier description and the ScreenSizes card
- [ ] At 1366, 1440, 1470 and 1710px wide the MacBook Air layout holds unchanged
- [ ] Beads needed shows 5 rows and Saved Patterns 10 thumbnails before expanding at this tier
- [ ] No regressions to the other tiers
