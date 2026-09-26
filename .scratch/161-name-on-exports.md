# 161: Name on exports

**What to build:** The maker can set their name for printed and PNG exports, as the NameOnExports card and `printed-output.md` describe. The Export ▾ menu ends with a "name on exports" row showing the name with Change, or "Not set" with Add. Change or Add opens a modal with an optional Your name field (up to 40 characters) and the hint "Printed on your PDF and PNG exports. Stays on this device." The name is kept on this device like the theme and never sent anywhere. This ticket stores and edits the name; ticket 162 prints it.

**Blocked by:** 148, 149

**Status:** ready-for-agent

- [ ] The Export menu row, modal, field, hint, Cancel and Save match the card, in English and Russian
- [ ] Enter saves, Escape cancels, an empty field clears the name
- [ ] The name survives reloads and is stored on the device only (ADR 0001)
- [ ] `CONTEXT.md` gains the term for the maker's name if it is a new domain concept
- [ ] Correct in the light, dark and high contrast themes
- [ ] Tests cover set, change, clear and persistence
