# 83: Responsive: laptop + 24–34″ large-display support

**What to build:** Extend ticket 79's breakpoint system upward to cover MacBook Air-sized laptops and 24–34″ large displays.

**Blocked by:** 79 (Responsive: phone/tablet breakpoints)

**Status:** ready-for-agent

**Note (performance plan, ADR 0018):** a larger canvas panel means a larger Drawing surface to redraw. Check drawing, hover and painting on the largest display width with ticket 103's performance check, at the floor CPU slowdown (a Core i3 laptop is the reference), so extra space does not cost the frame-rate targets.

- [ ] App shell layout adapts correctly at laptop and 24–34″ display widths
- [ ] Canvas panel makes reasonable use of the extra space at large sizes (not just a stretched phone layout)
- [ ] No regressions to the phone/tablet breakpoints from ticket 79
