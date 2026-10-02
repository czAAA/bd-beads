# 230: Shorter Russian labels where text is the only problem

**What to build:** Russian labels that overflow or wrap in their box get a shorter wording that fits at every screen width the app supports, so no Russian button, heading or tab is cut off or breaks onto a second line. Only the wording changes; layouts stay as they are. English is untouched.

The wordings below were each tried live in the app at all seven widths (1900, 1280, 1024, 768, 390, 360, 320 px); "fits" means it passed the check in ticket 229 everywhere that element appears.

| Place | Today | Proposed | Notes |
| --- | --- | --- | --- |
| Image colors button | Цвета изображения | Цвета | Fits at every width (measured). Decision from the user. "Цвета картинки" and "Из картинки" do not fit at 1024 and 768 |
| Tour "back to loom" button | Вернуться к ткачеству для первой схемы | К первой схеме | Decision from the user; shorter than the measured "К ткачеству" (fits everywhere), so it fits too. The note under it (backToLoomNote) still says Loom is chosen |
| Remove line (toolbox, phone sheet) | Удалить линию | Убрать | Only "Убрать" fits at 1024 and 768 (and the 320 phone sheet); "Удалить ряд" fits at 320 only. Keep the full "Удалить линию" as the tooltip and accessible name so the meaning isn't lost |
| Clear pattern (toolbox, phone sheet) | Очистить схему | Очистить | Fits everywhere. The confirmation dialog keeps the full "Очистить схему?" and its confirm button keeps "Очистить схему" (it has room) |
| Saved Patterns box heading | Сохранённые схемы | Мои схемы | Fits at 1024 and 768; "Схемы" also fits. Overview feature name "Сохранённые схемы" can stay (it is in a wide card), see carousel below |
| New Pattern: Convert image file label | Конвертировать изображение | Из картинки | Fits at 1024 and 320. "Из изображения" and "Из фото" also fit |
| New Pattern: Peyote and Brick buttons | Мозаичное плетение, Кирпичное плетение | Мозаичное, Кирпичное | Decision from the user: drop "плетение", the "Техника плетения" label above gives the context. Fits at 390 and 360, but NOT at 1024 and 320: the user's call is to keep these names and add a layout fix only where still needed (231). Loom stays "Ткачество" (fits except by 1px at 1024, same layout fix) |
| Overview carousel tab, Convert image | Конвертировать изображение | Из картинки (tab name only) | The full name stays on the card title. Check it fits in the tab at 1900, 1280, 1024 |
| Overview carousel tab, Techniques line | Ткачество, мозаичное и кирпичное плетение: каждая рисуется так, как ложится бисер. | Shorter second sentence for the tab line, e.g. "Ткачество, мозаика, кирпич: каждая рисуется как ложится бисер." (to be tried) | Tab line is 3 lines today; the target is the same line count the English tab has |
| Overview coffee tile title | Сделано одним человеком | Один автор (to be tried), or "Делает один человек" | Wraps to two lines at 390 and 360; try the candidates and keep the one that fits and reads naturally |

Where the table says "to be tried", the person implementing picks the wording that fits with the check (ticket 229) and reads naturally, preferring the proposal order given.

**Blocked by:** 229 (the check proves each wording fits)

**Status:** done

- [ ] Every row of the table is changed in the Russian strings only (English untouched), using the proposed wording or, for the "to be tried" rows, a wording that passes the check
- [ ] Where a label is shortened, the full wording stays available as the tooltip and the accessible name, so a screen reader and a mouse user still get the whole meaning
- [ ] The matching entries are removed from the check's pending list (229), and the check passes at all seven widths in both languages
- [ ] Peyote and Brick buttons: wording shortened here; their 1024 and 320 px overflow remains on the pending list for 231
- [ ] Glossary: CONTEXT.md / the translation notes record "Мозаичное" and "Кирпичное" as the short forms of the technique names, if the RU glossary lists them
- [ ] Unit tests that pin Russian strings are updated
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)

## Resolution note

The visual check from 229 was not built yet, so there was no pending list to trim and the widths were not re-verified by it. The pending entries for this ticket still need removing when 229 lands. The "to be tried" wordings (Один автор, the shortened Techniques tab line) were picked from the table's first proposals, not measured.
