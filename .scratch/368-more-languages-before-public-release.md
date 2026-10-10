# 368: More languages before the public release

**What to build:** Add Chinese, Spanish and Polish, Belarusian, Ukranian to English and Russian, then more left-to-right languages, so the public release reaches more people (ADR 0039). With the third language, numbers and plurals move to `Intl.NumberFormat` and `Intl.PluralRules` instead of the hand-rolled `formatNumber` and `plural.ts`. Chinese uses the device's system font. Right-to-left languages, Arabic among them, are out of scope.

**Blocked by:** None (can start immediately)

**Status:** needs-triage

- [ ] The final list of languages for the public release is decided
- [ ] `Intl.NumberFormat` and `Intl.PluralRules` replace the hand-rolled formatting and plural forms, with the existing English and Russian output unchanged
- [ ] Chinese, Spanish and Polish dictionaries exist, using CONTEXT.md's terms; the language switcher lists them
- [ ] The font stack falls back to the system CJK font for Chinese; nothing new is loaded from a third party
- [ ] The Text fit check passes in every new language at every width
- [ ] prepare table for every translated phrase RU - BY - UA
- [ ] `docs/agents/issue-tracker.md` no longer calls the language switcher EN/RU
- [ ] The ticket is archived in the same change
