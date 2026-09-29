# 165: Copy audit against the writing guide

**What to build:** Every English and Russian string in the app follows `writing.md`: the voice (no em dashes, US English), the sentence patterns for errors, field errors, empty states, results, loading and confirmations, the plural rules, the glossary terms and the color names. Also the fixes it lists: the Mirror summary as "↔ 1 · ↕ 0", Custom color and Colors in US spelling, and confirmation buttons that repeat the title.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Every string in both languages is checked against `writing.md`; changes are listed in the ticket when done
- [x] No em dashes in either language
- [x] Glossary terms are used consistently (Pattern / схема, Row done / Ряд готов, Delete all / Очистить всё, and the rest)
- [x] Tests that assert on copy are updated

**Done (ticket 165):** every string in `i18n/en.ts` and `i18n/ru.ts` checked against `writing.md`, plus a repo-wide grep for em dashes, "please"/"oops", exclamation marks and British spelling in user-facing code. Fixed:
- The five em dashes `writing.md`'s own "Strings to fix" table names: `storage.saveFailedMessage` and `convertImage.errors.tooLarge`/`tooManyPixels` (en and ru) now use a period or colon; ru `size.estimateWarning` now reads "Эти размеры приблизительные." instead of a dash before "оценка".
- `convertImage.noImageColors` (en and ru) and ru `shell.canvasPlaceholderHint` now match the approved wording in `writing.md`'s Russian table exactly.
- The Palette swatch's accessible name was "Color #hex" (`PalettePicker.vue`); `accessibility.md` calls for "Color 1, red". It's now `"{colorLabel} {index+1}, {colorName}"`, the name from the same `colorNames` table the PDF and Beads needed already use.
- `formatSizeMm` (`domain/patternSize.ts`) and `formatGrams` (`domain/beadQuantities.ts`) always wrote a "." regardless of language; both now take the app's `locale` and use "," for Russian (writing.md, Numbers). Three tests had baked the wrong expectation in under a Russian locale (`App.resize.test.ts`, `App.test.ts`, `SizeControls.test.ts`) and are corrected; two new tests cover the comma directly.
- rowProgress.previousButton ("Row not done"/"Ряд не готов"), the Mirror summary ("↔ 1 · ↕ 0"), US "Color"/"Colors"/"Custom color", confirmation buttons repeating their title (Delete all?/Delete all, Replace bead?/Replace bead, Change size/Change size), thousands grouping in Beads needed and the PDF, ё usage, «guillemets» around quoted buttons, and Russian plural forms (few/many) were all already correct from earlier tickets: checked, not changed.
- `transfer.pdfCountHeading` (ru "Бисер" → "Бисеринок") no longer exists: the PDF's own text moved into the `print` section in ticket 162, which already says "Бисеринок" in `beadsGrams`/`beadsCount`.
