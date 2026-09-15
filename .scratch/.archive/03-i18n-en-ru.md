# 03: Localize the UI with an EN/RU language switcher

**What to build:** Add an i18n layer to the app so all UI text (labels, buttons, headings) can be shown in English or Russian, with a visible switcher to toggle between them. Use the canonical Russian terms already recorded in [CONTEXT.md](../../../CONTEXT.md)'s Language section (e.g. Схема for Pattern, Бисеринка for Bead, Техника плетения for Technique) rather than retranslating from scratch.

**Blocked by:** 01

**Status:** done

- [ ] Every piece of UI text shipped so far (New Pattern form labels/options, buttons, headings) has both an English and a Russian translation
- [ ] A visible switcher lets the user toggle the UI language between EN and RU at any time
- [ ] Russian translations reuse the exact terms from CONTEXT.md's glossary, not new/inconsistent wording
- [ ] The chosen language persists across reloads (localStorage, consistent with [ADR 0001](../../../docs/adr/0001-local-only-persistence.md))
- [ ] Defaults to Russian on first visit with no saved preference
- [ ] New UI added by later tickets is expected to plug into the same translation mechanism (not a one-off)
