# 43: Custom color picker

**What to build:** The Colors group gains one extra slot after the Palette swatches: a color picker. Clicking it opens the browser's native color chooser; choosing a color immediately makes it the paint color, and the slot shows that color and appears selected. Painting with it works like any Palette color, and painted cells show up in Beads needed like any other color.

**Blocked by:** 40

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Glossary: **Custom color** (RU: Свой цвет) — a one-off color outside the Palette. It is not added to the Palette and not remembered: choosing another replaces it, and it's gone on reload.
- Occupies one slot in the Colors group (12 + 1 = 13, so no expansion yet).
- Uses the native color input, no custom picker UI.

- [ ] A color picker slot sits at the end of the Colors group
- [ ] Choosing a color selects it as the paint color and the slot reflects it as selected
- [ ] Selecting a Palette swatch afterwards deselects the Custom color slot, and vice versa
- [ ] Cells painted with a Custom color appear in Beads needed with that color
- [ ] The Palette itself is unchanged; choosing a new Custom color replaces the previous one
