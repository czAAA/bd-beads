# 26: Undo and Remove buttons become icons

**What to build:** Replace the text "Undo" button with an icon-only button using a plain inline SVG counter-clockwise arrow. Replace the saved-Pattern list's "Remove" (`pattern-list__remove`) text button with an icon-only button (a trash/delete glyph), keeping its existing destructive styling (see ticket 17). Both use inline SVGs styled to match the app's flat thick-outline look.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] The Undo button renders as an icon (inline SVG counter-clockwise arrow) instead of the text label
- [ ] The saved-Pattern list's Remove button renders as an icon (inline SVG trash/delete glyph) instead of the text label, keeping its destructive (red/amaranth) styling
- [ ] Both buttons remain accessible — each keeps (or gains) an `aria-label`/visually-hidden text conveying its action ("Undo"; "Remove: <pattern summary>") for screen readers
- [ ] Undo's disabled state (no undo history) remains visually distinguishable, same as today
- [ ] Icon styling (stroke width, color) matches the app's existing flat/thick-outline visual style
