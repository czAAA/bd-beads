# 221: Overview hand-drawn layer

**What to build:** The drawn layer the design system puts behind the Overview: bead drawings (flower, heart, bee, spool, leaf, rhombus, sparkles) in Palette colours at the page edges, the large ones at 16% opacity, and three to five X1 marks per section at 8% `accent`, as on the PDF exports. Everything sits behind the content and never touches text. This goes last because it is placed around the sections the other tickets build.

**Blocked by:** 216, 217, 218, 219, 220

**Status:** done

- [x] Each section (hero, What's inside, coffee, Three ways to use it) carries the drawings and X1 marks the design system places there, at the stated opacities
- [x] All of it is `aria-hidden`, behind the content, unreachable by keyboard and pointer, and never overlaps text or controls at any of the five screen sizes
- [x] The large drawings are hidden at the sizes where the design system hides them
- [x] The X1 marks reuse the design system's mark; no other logo or borrowed imagery
- [x] Decoration adds no noticeable weight to loading the Overview
- [x] English and Russian copy from the design system (Writing section, "Copy added in v15"); the page still starts in English on a device with no saved language
- [x] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [x] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows); loads no third-party fonts or scripts
- [x] Matches the Overview card and its preview in the design system
- [x] Overview and Tour question (CLAUDE.md): not applicable, this ticket completes the Overview itself

**Notes:** The design system's preview places the drawings for one layout, so each placement was fitted to this page at five size bands (under 744, 744, 1024, 1440, 1920) in English and Russian; one with no clear spot at a band is left out there, so the phone keeps only a few small drawings and marks per section.
