# 80: Tour

**What to build:** The Tour (see `CONTEXT.md`): a skippable walk through the real editor that takes a new user from nothing to their first Pattern by doing. Each step's card (ticket 208's Tour step card) points at one control with a dotted connector, dims the rest of the app, says what the control does and asks the user to use it, and moves on once they have. Every user ends with the same finished Pattern, ticket 208's Tour Pattern artwork: 30 × 120 on loom with the default Bead, gold and black halves with swapped-color accents.

**Blocked by:** 208 (Design system v15: Overview, Tour and the header menu), 210 (Header menu replaces the More menu), 77 (Overview), since a new visitor reaches the Tour through the Overview's button

**Status:** ready-for-agent

**The twelve steps** (each card shows "n of 12"):

1. **Create**: the user names the Pattern and tries Technique, Bead and the size units in the New Pattern form. The Tour then sets it back to loom, the default Bead and 30 × 120, keeping the name ("Back to loom for your first Pattern" in meaning), and the step is done on Create.
2. **Fill**: fill the whole background gold (`yellow`).
3. **Divider**: paint the highlighted black row across the middle.
4. **Fill half**: fill the lower half black; the divider stops the Fill.
5. **Paint**: paint the highlighted accents, gold on black and black on gold.
6. **Copy and paste**: select and copy the highlighted accent, then paste it at the highlighted spot on the other half.
7. **Finish**: the Tour completes the design from the artwork as one Undo step, leaving one stray bead.
8. **Eraser**: erase the stray bead.
9. **Remove row/column**, then **Undo** to bring it back.
10. **Resize** with the Size group's −/+ (not Change size), then **Undo**.
11. **Export as PDF**: done when the PDF is downloaded.
12. **Row progress**: turn it on, mark rows 1 to 3 done, then mark row 3 not done again.

**Offer, resume, skip:**

- Offered on this device when the Pattern library is empty and the Tour has been neither finished nor turned off (for a new visitor, through the Overview's "Make your first Pattern").
- An unfinished Tour that wasn't turned off resumes at its first step not done, whatever the library holds; which steps are done is remembered on this device.
- **Skip tour** (or Escape) turns the Tour off for good and shows ticket 208's toast saying it can be started again from the menu. Finishing ends on the last card ("Your first Pattern is ready" in meaning) with the same hint and no toast.
- **Take the tour** in the header menu (ticket 210) starts it again from step 1 at any time, finished or turned off.

- [ ] The Tour runs in the real editor, and the Pattern it builds is a real Pattern in the Pattern library, kept after Skip
- [ ] Each step moves on when the user does its action; every card also has Next, so a step the browser blocks (e.g. the PDF download) can't trap the user
- [ ] The dim layer blocks everything but the pointed control, the card, and scroll and zoom on the canvas
- [ ] Following the steps as asked ends with a grid identical to the Tour Pattern artwork, and step 9 and 10's Undo restores it exactly
- [ ] Offer, resume, Skip, finish and restart behave as above
- [ ] This ticket adds the Take the tour item to the header menu
- [ ] Works at all five screen sizes (on the phone, pointing into the bottom toolbar and sheets); a card whose control isn't on screen is centred without a connector
- [ ] Keyboard and screen reader: focus moves into the card, each step is announced (ticket 192's announcer), Escape skips
- [ ] English and Russian copy from the design system; correct in the light, dark and high contrast themes
- [ ] No Mirror step while its controls are hidden (ticket 174)
