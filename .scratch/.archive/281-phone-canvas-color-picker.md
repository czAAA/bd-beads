# 281: Canvas color on the phone

**What to build:** The Canvas color selector lives in the CanvasStrip, which is hidden at 743px and below (`CanvasPanel.vue`), so a phone user cannot change the background. The `CanvasBackground` card (proposed, v15 draft) opens the picker from the Pattern sheet header on a phone. Build it there, with the same eleven backgrounds, the same radio-group behaviour and the remembered choice. Interactive: where exactly it goes in the sheet header is a design call to check on a phone. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** interactive

**Status:** ready-for-agent

- [ ] On a phone a person can open the Canvas color picker from the Pattern sheet header, pick any of the 11 backgrounds, and see the canvas change; the choice is remembered as on desktop
- [ ] The picker is hidden in high contrast, as on desktop; it fits 320px; focus order and screen-reader names are right in English and Russian
- [ ] The `CanvasBackground` card, `responsive.md` and the sheet's card describe where it lives; the README Version changelog has a line
