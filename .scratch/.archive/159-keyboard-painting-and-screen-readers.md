# 159: Keyboard painting, focus order and screen readers

**What to build:** The app works fully from the keyboard and with a screen reader, as `accessibility.md` and the BeadCursor, KeyboardFocus and ScreenReaders cards describe. A Skip to Pattern link and a fixed tab order; one tab stop per group with arrow keys inside (tool tabs, swatches, segmented controls, the theme control). The Pattern is one tab stop with a bead cursor: arrows move, Shift + arrows extend a Selection, Home, End, Page Up and Page Down jump, Space or Enter uses the current tool, and the rulers mark the cursor's row and column. Escape closes the top-most thing first. Screen readers get landmarks, the Pattern as an image with a summary name, a name for every icon-only button, and one polite announcement per action.

**Blocked by:** 75, 140, 142, 143, 144

**Status:** done

- [x] Tab order is: Skip to Pattern, header, Toolbox, save box, Beads needed, Saved Patterns, canvas strip, the Pattern, Progress bar; focus is never hidden behind the header or a toolbar
- [x] The bead cursor ring is 2px `focus-ring`, 2px outside the bead (3px in high contrast), shown only after keyboard focus; the view keeps it two beads from any edge; the strip shows "arrows move · space paints · esc leaves"
- [x] Painting, filling, selecting and erasing all work from the keyboard and use the same undo history as the pointer
- [x] Escape closes in order: modal, sheet or drawer, menu, Selection, open disclosure row
- [x] Landmarks `header`, `aside` "Tools" and `main`; the Pattern is `role="img"` named like "Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done"
- [x] Moving the cursor announces "Row 4, column 5, orange" and painting announces "Painted blue"; results are `status`, errors `alert`, nothing is announced for single-bead pointer painting
- [x] Every icon-only button has the name from the ScreenReaders card, in English and Russian; toggles use `aria-pressed`, disclosure rows `aria-expanded`
- [x] Tests cover the cursor keys, the tab order and the announcements

**Done (ticket 159):** what waits for other tickets: the save box's place in the tab order comes with ticket 148; Escape's modal and menu steps with ticket 76's Modal and Menu (today's modals keep their own Escape); sheets and the drawer with tickets 79 and 168. Swatch names stay "Color #hex" until the copy audit (ticket 165) moves them to "Color 1, red".
