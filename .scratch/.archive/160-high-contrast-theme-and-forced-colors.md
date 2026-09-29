# 160: High contrast theme and forced colors

**What to build:** The third theme, High contrast, looks right everywhere, as `accessibility.md` and the HighContrastTheme and ContrastAudit cards describe: text at least 7:1, every line 2px, every surface white, no elevation, a 3px black focus ring, and bead colors unchanged. It follows `prefers-contrast: more` while the theme control is on Match device. With Windows `forced-colors: active`, system colors win and outlines, borders, focus, the active tab and the open Pattern stay visible.

**Blocked by:** 139, 140

**Status:** done

- [x] Every screen and state checked in high contrast against the ContrastAudit card; each failure fixed
- [x] The canvas renderer's `PatternTheme` has a high contrast variant (board, rulers, marker, cursor); bead colors are never altered
- [x] Forced colors mode keeps every control's edge and every selected state visible
- [x] No state relies on color alone: each has a shape or a word too

**Done (ticket 160):** checked every screen and state in high contrast (the editor, empty canvas, New Pattern, framing, Export menu, Saved Patterns and Beads needed expanded, Delete all, Keyboard shortcuts, QR, Image colors, the Saved toast) against the HighContrastTheme and ContrastAudit cards. The tokens (7:1 text, `#595959` lines, white surfaces, no elevation, the 3px black focus ring) and the renderer's CONTRAST_THEME (board, rim, marker, cursor, bead colors untouched) were already in place from tickets 136, 140 and 159; the controls thicken their own edges. What failed and is fixed, in `src/styles/contrast.css`: the boxes, the canvas box, the header and every rule between things were 1px (and the strip and Progress bar rules a faint mix): all are 2px in their line color now; the Bead pill was white on white and has an edge. Forced colors (checked with Chrome's emulation) lost every bead color and the Switch and drew the background word over the rulers: the Pattern, the swatches, the thumbnails, the QR code and the loading beads keep their colors (`forced-color-adjust: none`), the word and curve step aside, and focus, the active tab, the chosen segment, the on Switch, the selected swatch and the open Pattern use `Highlight`. States never rely on color alone: the active tool has its underline and `aria-pressed`, swatches their ring, errors their icon and sentence, the open Pattern its ring. contrast.test.ts fails if a class the sheet names stops existing.
