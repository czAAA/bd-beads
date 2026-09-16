# 30: Row Progress card — icon buttons with hover tooltips, sized no taller than Palette

**What to build:** The "Previous row" and "Row done" step buttons in the Row Progress ("Прогресс по рядам") card become icon buttons, with the same hover/focus tooltip treatment as ticket 29's Mirror icons and the existing Undo/Rotate icons — a `title` + `aria-label` pairing, no new tooltip mechanism. As with Mirror, this stops the Row Progress card from forcing every card in its `.tool-strip` row taller than the Palette card, since `align-items: stretch` matches every card's height to the tallest one on the line.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The previous-row and next-row ("Row done") buttons render as icon buttons, not text buttons
- [ ] The two icons clearly distinguish "go back a row" from "mark this row done / advance", and are visually distinct from the Undo/Rotate/Mirror icons
- [ ] Hovering or keyboard-focusing either icon shows the existing English/Russian button text as a tooltip
- [ ] Screen readers still announce the same descriptive text via `aria-label`
- [ ] The disabled state (previous row at row 1; next row at the last row) still reads visually as disabled on the icon buttons
- [ ] The Row Progress card's rendered height is no taller than the Palette card's rendered height, in both English and Russian, at the default window width
- [ ] Clicking the icon still performs the same row-move behavior as before — only presentation changes, not behavior
- [ ] Existing tests covering these buttons (`row-progress-previous` / `row-progress-next` testids) still pass unchanged
