# 165: Copy audit against the writing guide

**What to build:** Every English and Russian string in the app follows `writing.md`: the voice (no em dashes, US English), the sentence patterns for errors, field errors, empty states, results, loading and confirmations, the plural rules, the glossary terms and the color names. Also the fixes it lists: the Mirror summary as "↔ 1 · ↕ 0", Custom color and Colors in US spelling, and confirmation buttons that repeat the title.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Every string in both languages is checked against `writing.md`; changes are listed in the ticket when done
- [ ] No em dashes in either language
- [ ] Glossary terms are used consistently (Pattern / схема, Row done / Ряд готов, Delete all / Очистить всё, and the rest)
- [ ] Tests that assert on copy are updated
