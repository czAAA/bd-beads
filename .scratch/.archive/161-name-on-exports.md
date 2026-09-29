# 161: Name on exports

**What to build:** The maker can set their name for printed and PNG exports, as the NameOnExports card and `printed-output.md` describe. The Export ▾ menu ends with a "name on exports" row showing the name with Change, or "Not set" with Add. Change or Add opens a modal with an optional Your name field (up to 40 characters) and the hint "Printed on your PDF and PNG exports. Stays on this device." The name is kept on this device like the theme and never sent anywhere. This ticket stores and edits the name; ticket 162 prints it.

**Blocked by:** 148, 149

**Status:** done

- [x] The Export menu row, modal, field, hint, Cancel and Save match the card, in English and Russian
- [x] Enter saves, Escape cancels, an empty field clears the name
- [x] The name survives reloads and is stored on the device only (ADR 0001)
- [x] `CONTEXT.md` gains the term for the maker's name if it is a new domain concept
- [x] Correct in the light, dark and high contrast themes
- [x] Tests cover set, change, clear and persistence

**Done (ticket 161):** the maker's name lives in `domain/makerName.ts` under `bd-beads:maker-name`, trimmed and cut at 40 characters, removed when saved empty; the App owns it and hands it to the save box. The Export menu ends with the "name on exports" row (the name, or "Not set" with Add), which opens NameOnExportsModal: Your name (optional, `maxlength` 40), the hint, Cancel and Save, Enter saving through the form and Escape cancelling through the Modal. CONTEXT.md gains **Maker's name**. The same change anchors menus and popovers to their button with fixed positioning (useAnchoredPosition), flipping above when there is no room below: inside the left column, which scrolls on its own, the Export menu's new last row was clipped. Ticket 162 prints the name.
