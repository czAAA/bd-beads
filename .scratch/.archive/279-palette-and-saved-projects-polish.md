# 279: Palette swatch and Saved Projects polish

**What to build:** Four small differences from the v16 to v18 cards: (1) the × removal badge shows on a selected or keyboard-focused added swatch, but `PalettePicker.vue` shows it for selected only; (2) the swatch focus ring is 2px away, the app's is 4px; (3) the Custom swatch glyph is a 14px hatched square in `muted`, the app's is a 12px swatch of the chosen colour, hatched in `faint` only before one is chosen; (4) Saved Projects shows "no Frame" where the size goes for a Project without a Frame, where `ProjectList.vue` shows the beads' bounding-box size. The card wins for each unless the app's choice is documented in ticket 284. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** done

- [x] The × badge shows on a focused added swatch as well as a selected one; Delete and Backspace still remove it; the touch hit area (a deliberate larger one) is kept and noted on the card in ticket 284
- [x] The swatch focus ring offset matches the card in all three themes and forced colors
- [x] The Custom glyph is the card's hatched `muted` square, always
- [x] A saved Project with no Frame says "no Frame" in the list; one with a Frame shows its size as now
- [x] Unit and visual tests for the changed components; the README Version changelog has a line
