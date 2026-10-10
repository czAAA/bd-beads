# 368: More languages before the public release

**What to build:** Add Chinese, Spanish and Polish, Belarusian, Ukranian to English and Russian, then more left-to-right languages, so the public release reaches more people (ADR 0039). With the third language, numbers and plurals move to `Intl.NumberFormat` and `Intl.PluralRules` instead of the hand-rolled `formatNumber` and `plural.ts`. Chinese uses the device's system font. Right-to-left languages, Arabic among them, are out of scope.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The final list of languages for the public release is decided: English, Russian, Ukrainian, Belarusian, Chinese, Spanish and Polish. Other left-to-right languages follow the same steps and need a ticket each.
- [x] `Intl.NumberFormat` and `Intl.PluralRules` replace the hand-rolled formatting and plural forms, with the existing English and Russian output unchanged
- [x] Chinese, Spanish, Polish, Ukrainian and Belarusian dictionaries exist, using CONTEXT.md's terms; the language switcher lists them (one button showing the current code, opening a list of every language, up or down)
- [x] The font stack falls back to the system CJK font for Chinese; nothing new is loaded from a third party
- [x] The Text fit check passes in every new language at every width
- [x] A table of every translated phrase for RU, BY and UA is prepared for offline review (`ru-be-uk-review.md`, English as the reference)
- [x] `docs/agents/issue-tracker.md` no longer calls the language switcher EN/RU
- [x] The ticket is archived in the same change
