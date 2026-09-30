# 216: Overview hero band and hand-written notes

**What to build:** The hero of the Overview (ticket 77) gets the parts the design system's Overview card specifies and ticket 77 left out: the Tour Pattern lying across the page as a band on its `board` with no ruler, "you'll make this" centred under it in `note-gold`, the notes "you" (on the first slogan word) and "on us" (on the "save. count. export" line), "eleven small steps" with a thin arrow beside the buttons from 1024px, and the hand-drawn arrows that go with them. With Patterns saved, the hero shows only **Open the editor** (primary) and "Patterns saved: {n}" with no notes and no band. The band is drawn with the real Pattern renderer, so a bead looks as it does in the editor.

**Blocked by:** None (can start immediately). Ticket 77 is done.

**Status:** ready-for-agent

- [ ] The Tour Pattern's cell data (10 × 75, loom, Yellow and Black only, counts Yellow 294, Black 452, empty 4) is carried in the app, with a test that compares it with the design system's Tour Pattern data so the two can't drift
- [ ] A new visitor sees the band across its `board` with no ruler and "you'll make this" under it; a visitor with saved Patterns sees neither the band nor the notes
- [ ] The band is drawn by the real Pattern renderer, and the Overview page does not load the editor's code beyond what drawing needs
- [ ] The notes use the `note` type role (`accent-strong` for "you" and "on us", `note-gold` for "you'll make this") and 1.25px hand-drawn arrows, all `aria-hidden`
- [ ] The slogan and the two buttons keep behaving as in ticket 77
- [ ] English and Russian copy from the design system (Writing section, "Copy added in v15"); the page still starts in English on a device with no saved language
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Uses the design system tokens and type roles only (no hardcoded colors, fonts, sizes or shadows); loads no third-party fonts or scripts
- [ ] Matches the Overview card and its preview in the design system
- [ ] Overview and Tour question (CLAUDE.md): not applicable, this ticket completes the Overview itself
