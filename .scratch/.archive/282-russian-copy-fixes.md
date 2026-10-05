# 282: Russian copy: the clear rule violations

**What to build:** Fix the Russian strings that break `writing.md`'s rules or the Russian glossary: no em dashes (`ru.ts` lines 115, 116 and 447: "прокрутка: масштаб", "прокрутка или пробел и перетаскивание: сдвиг"); the Saved Projects heading is «Сохранённые проекты», not «Мои проекты» (`ru.ts:87`); the technique labels are the full «Мозаичное плетение» and «Кирпичное плетение» and the control lets the label wrap to two lines instead of cutting it (`LongerText` card); the visible label of Remove line is «Удалить линию», not «Убрать» (`ru.ts:296`); `setFrameHint` uses the glossary's words (`ru.ts:413`, «бисеринки», «схема» only where the glossary says so). The strings the design system doesn't specify are ticket 283. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** done

- [x] Each string above is changed, and a test (or the existing i18n test) fails on an em dash in `ru.ts` and `en.ts` going forward
- [x] The segmented control fits the full technique labels at every width from 320 to 1900 px without clipping, and the Russian visual references are regenerated deliberately
- [x] `writing.md`, the cards and the app agree on each of these strings; the README Version changelog has a line
