# 283: Review the Russian copy the design system doesn't settle

**What to build:** These Russian strings have no reviewed wording in the design system, so an agent shouldn't pick them: Clear (today «Очистить» and «Очистить?», the old «Очистить всё» was Delete all); Save Project (today «Сохранить»); the colour-removed Message (card, marked proposed: «Цвет убран из палитры.»; app: «Цвет удалён из палитры.»); the coffee tile title («Сделано одним человеком» in the card, «Один автор» in the app); and the three Frame margin leads from ticket 277 and the noun for bead in them (the card says «фрагмент», the glossary says «бисеринка»). Decide each wording and write it into `writing.md` and the cards; an agent then applies it in `ru.ts`.

**Blocked by:** 273

**Human involvement:** a person only (a Russian speaker)

**Status:** ready-for-human

- [ ] Each string above has a chosen Russian wording in `writing.md` and its card, with the reason in one line where it isn't obvious
- [ ] `ru.ts` matches, in a follow-up change by an agent (add a ticket if it is more than a few lines); the README Version changelog has a line
