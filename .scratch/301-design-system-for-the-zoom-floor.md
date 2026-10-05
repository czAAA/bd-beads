# 301: Design system and tokens for the new Zoom floor

**What to build:** The design system says what the app now does (ADR 0033, DESIGN.md §6): one 10% Zoom floor, the Ruler step, Ruler dots and the 10% zoom step. The three `bead-min-*` tokens that repeat `bead-min-tablet` go, and the two that stay are reworded as the bead size where numbers need more room. A visual test shows the rulers at 100, 50, 25 and 10%.

**Blocked by:** 298 (Zoom out to 10% on every screen, with the ruler numbers thinning), 299 (Ruler dots between the numbers, selecting their row or column), 300 (Zoom buttons move 10% at a time).

**Status:** ready-for-agent

- [ ] `bead-min-tablet-lg`, `-laptop` and `-desktop` are removed from `tokens.json`, `bundle.css` and `design-values.css`; the two left are reworded
- [ ] The Rulers card, `responsive.md` ("Smallest bead") and `interaction-and-motion.md` ("stops at the floor") describe the Zoom floor, Ruler step and Ruler dots
- [ ] A line in the design system README's Version changelog
- [ ] A visual test of the rulers at 100, 50, 25 and 10%
