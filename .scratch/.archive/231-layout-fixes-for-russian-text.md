# 231: Layout fixes where Russian text can't be shortened enough

**What to build:** The places where even the shortest sensible Russian text doesn't fit because the layout around it is too tight now adapt: they make room, switch to an icon, or wrap. No Russian control or popover is cut off or runs off the screen at any supported width.

Findings and the fix to apply (verified by trying the shorter wordings live in the app):

1. **Save button (left column, 1900 to 768 px, and the phone Dock's Pattern sheet at 390 and 360).** "Сохранить схему" overflows by 40px at 1900 and 1280; even the shortest "Сохранить" still overflows by 14px at 1900, by 28px at 1024 and 27px at 768, and "Сохр." overflows at 1024 and 768. The Save and Export buttons share one row of a narrow column. Fix: when the label doesn't fit, Save shows the save icon alone (it already has an icon, the title "Save (Ctrl/Cmd+S)" and an accessible name; the accessible name must stay the full wording), and the label returns when there is room. Also change the Russian label to "Сохранить" so it fits wherever the text is shown. Choose the breakpoint from the check (229), not a guess.
2. **Peyote and Brick buttons in the New Pattern form (1024 px, 320 px).** After 230 ("Мозаичное", "Кирпичное") they still overflow at 1024 and 320 (Loom by 1px at 1024). Fix: the technique control wraps or stacks (one button per row at narrow widths) instead of squeezing three buttons into one row.
3. **Weight estimate popover in Beads needed (1900 to 768 px).** The popover text is cut off by the left column by 67px. This is a placement and width problem (it should stay inside its column or the screen and wrap), and the Russian text is only longer than the English; fix the popover, and also shorten the text: "Вес = число бисеринок × около {grams} г. Среднее из объявлений продавцов, точность не подтверждена. Бисер бывает разным, берите с запасом." (keep the existing last sentence's meaning).
4. **Name on exports dialog (360 and 320 px).** The dialog's footer, with its Cancel and Save buttons, ends 8px (360) to 48px (320) past the screen's edge even with the shortest label, and the "необязательно" aside and hint text overflow the same way at 320. Fix: the dialog stays within the screen width and its footer buttons wrap or stack, or share the width, on narrow phones.
5. **Any further finding the check (229) raises on 320 px phones** (ruler numbers at the right edge of the canvas, 14, 15 and 16, run past the canvas box at 320 and 360 px; they appear in English as well, so they are checked here, and fixed only if the ruler is meant to be fully inside the canvas box at those widths; otherwise the check is told they are intentionally clipped).

6. **Everything else on the pending list in `e2e/support/textFitPending.ts` marked `'231'`** (Russian-only: the Overview plan names and "Create free account" button, "Три способа работать", Saved Patterns' "Экспортировать все" up to 768, the Tour's "Увеличить" tooltip and a step title at 320, the Overview example paper's "Ткачество"), plus the Russian side of the dialogs that overflow on phones. The places marked `'unassigned'` there fail in English too and need their own ticket(s); the dialogs' phone width is probably one fix.

**Blocked by:** None (229 and 230 are done; the check proves each fix)

**Status:** done

- [ ] Save shows the icon alone when the label does not fit, with the full name kept as its accessible name and tooltip; the label is shown whenever there is room
- [ ] The technique control in the New Pattern form fits at 1024 and 320 px with the shortened names from 230
- [ ] The weight estimate popover stays inside its column or the screen at every width and wraps its text, in both languages
- [ ] The Name on exports dialog (and the other dialogs, as the check finds) fit the screen at 360 and 320 px with nothing past its edge
- [ ] The ruler numbers on narrow phones are either fixed or recorded as intentional in the check
- [ ] The matching entries are removed from the pending list in 229, which is now empty: the check passes strictly at all seven widths in both languages
- [ ] Looks right in the light, dark and high contrast themes, and works with the keyboard alone; layouts keep matching the design system's component specs (DESIGN.md), no hardcoded colors, fonts, sizes or shadows
- [ ] Existing reference screenshots stay valid, or are updated only where the layout was meant to change
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)
