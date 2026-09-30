# 80: Tour

**What to build:** The Tour (see `CONTEXT.md`): a skippable walk through the real editor that takes a new user from nothing to their first Pattern by doing. Each step's card (the design system's TourStep card) points at one control with a dotted connector, dims the rest of the app, says what the control does and asks the user to use it, and moves on once they have. Every user ends with the same finished Pattern, the design system's TourPattern artwork: 10 × 75 on loom with the default Bead, gold rhombuses with a black eye on black, like a Belarusian rushnik band.

**Blocked by:** 208 (Design system v15: Overview, Tour and the header menu), 210 (Header menu replaces the More menu), 77 (Overview), since a new visitor reaches the Tour through the Overview's button

**Status:** done

**The eleven steps** (ticket 208's outcome: the design system has 11 steps and a 10 × 75 Pattern, not 12 steps and 30 × 120; each card shows "n of 11"):

1. **Start a Pattern**: the user names the Pattern and tries Technique, Bead and the size units in the New Pattern form. Whatever Create is pressed with, the Tour makes its own Pattern: loom, the default Bead and 10 × 75 beads, keeping the name. "Back to loom for your first Pattern" sets the form back first.
2. **Fill the background**: Fill with black over the whole Pattern.
3. **Paint the outline**: Paint, yellow, the 22 marked beads of the first rhombus.
4. **Fill the rhombus**: Fill, yellow, inside the outline (the outline stops the Fill).
5. **Paint the eye**: Paint, black, the 16 marked beads.
6. **Copy the rhombus**: Select the rhombus, Copy, paste it into the four outlines below.
7. **We'll finish the rest**: Next adds the 28 beads between the rhombuses and at the corners as one Undo step, leaving one stray bead.
8. **Erase the stray bead**.
9. **Remove a line**, then Undo to bring it back.
10. **Change the size** (Change size, since ticket 172 removed the −/+ steppers), then Undo.
11. **Track your rows**: turn Row progress on, Row done three times, Row not done once.

The last card is "Your first Pattern is ready", pointing at Export (the Pattern button on the phone), with Keep editing and Export. The design system has no Export-as-PDF step.

**Offer, resume, skip:**

- Offered on this device when the Pattern library is empty and the Tour has been neither finished nor turned off (for a new visitor, through the Overview's "Make your first Pattern").
- An unfinished Tour that wasn't turned off resumes at its first step not done, whatever the library holds; which steps are done is remembered on this device.
- **Skip tour** (or Escape) turns the Tour off for good and shows ticket 208's toast saying it can be started again from the menu. Finishing ends on the last card ("Your first Pattern is ready" in meaning) with the same hint and no toast.
- **Take the tour** in the header menu (ticket 210) starts it again from step 1 at any time, finished or turned off.

- [x] The Tour runs in the real editor, and the Pattern it builds is a real Pattern in the Pattern library, kept after Skip
- [x] Each step moves on when the user does its action; every card also has Next, so a step that can't be done can't trap the user
- [x] The dim layer blocks everything but the pointed control, the card, and scroll and zoom on the canvas
- [x] Following the steps as asked ends with a grid identical to the Tour Pattern artwork, and step 9 and 10's Undo restores it exactly
- [x] Offer, resume, Skip, finish and restart behave as above
- [x] This ticket adds the Take the tour item to the header menu
- [ ] (built, not seen in a browser: none was available) Works at all five screen sizes (on the phone, pointing into the Dock and sheets); a card whose control isn't on screen is centred without a connector
- [x] Keyboard and screen reader: focus moves into the card, each step is announced (ticket 192's announcer), Escape skips
- [x] English and Russian copy from the design system
- [ ] (built with the theme tokens, not seen in a browser) Correct in the light, dark and high contrast themes
- [x] No Mirror step while its controls are hidden (ticket 174)

**Overview and Tour:** not asked. This ticket is the Tour itself, and the Overview (ticket 77) already says "eleven small steps".

## Notes from the build

- The Tour's rules are in `src/domain/tour.ts` (steps, the grid after each step, when a step is done, which control or beads it points at); `src/composables/useTour.ts` holds the state and does Next, Skip and start-again; `src/components/TourLayer.vue` draws the dim layer, the ring, the dotted line and the card. The artwork is `src/domain/tourPatternData.json`, a copy of the design system's `tour-pattern.json` that `tour.test.ts` keeps equal.
- Controls are found on the screen by a `data-tour` mark, so one step works at every size: the same control is in the Toolbox, the BottomToolbar or a sheet, and the first one showing is pointed at. A control that isn't showing is reached through what opens it (the Dock button, the Tools button, the color button on the iPad mini); if nothing is, the card is centred with the "isn't on screen" line.
- The dim layer blocks presses everywhere but the hole, the card and the Pattern's box. The Pattern is always a hole for the pointer, so it still scrolls and zooms; while the step isn't about drawing, the shell's pointer and keyboard-cursor handlers do nothing (`unlessTourLocks` in `useAppShell`).
- A step is done when the grid is exactly what the step draws, so the Tour Pattern always ends identical to the artwork; Next applies the step's grid as one Undo step. A wrong bead is fixed with Ctrl/Cmd+Z, or by Next.
- Progress (which steps are done, and the Pattern being built) is in `localStorage` (`bd-beads:tour-progress`). A Tour whose Pattern is gone starts over at step 1.
- Where the ticket and the design system differ from the app: the design system says "Press − or + next to Columns" in step 10, but ticket 172 removed those steppers, so the step points at Change size and its card text says so (English and Russian); step 9 also points at a ruler number first, because Remove line needs a whole row or column selected, with one extra line of copy. Both are copy the design system doesn't have yet.
- The Overview's menu gets Take the tour too (it starts the Tour from step 1, clearing what was done).
- No visual reference screenshots were added: no browser was available to make them.
