# 343: Spec: one control registry, shared controls and Tooltips everywhere

**Status:** ready-for-agent

**Tickets:** 327–342 implement this spec. ADR 0035 records the main decision.

## Problem Statement

A maker using bd-beads gets different help for the same control depending on where they meet it:
- **Inconsistent hover help.** Paint has a Tooltip with its key and a description in the Toolbox, but only a bare name in the Dock. Rotate has a styled Tooltip in one place, a slow native browser `title` in another and nothing in a third. Many icon-only buttons (Clear selection, sheet close, the Frame number chip) show nothing on hover, so the only way to learn them is to press them.
- **No reason for disabled controls.** A disabled control gives no reason: Remove Frame, Rotate or Fit to drawing simply don't respond, and the maker has to guess whether a Frame, a Selection or turning off Row progress is missing.
- **Wrong or missing keys.** Some keys exist but are never shown (Rulers `R`, Row direction `D`). Some shown keys don't do what the button does: `Del` switches to the Eraser rather than removing the selection.
- **Hidden helper text.** The size estimate and the Bead quantities explanation hide their text behind an (i) button that has to be clicked.
- **Two Row progress controls.** On a phone, the Zoom pill's Progress bar toggle and the Row progress switch look like two separate things but control almost the same state.
- **The New Project form asks for a size twice.** It asks for a Frame, unit and width/height that the Frame section of the Toolbox already sets.

Behind all of this, each control is written separately for the Toolbox, the phone sheets, the Dock, the ContextBar and the Zoom pill, and the copies have drifted apart.

## Solution

Every control is defined once and looks and behaves the same wherever it appears:
- **Tooltips.** Every control that is given a Tooltip shows the same light, slightly see-through Tooltip on hover, keyboard focus and long-press. It has a name, an optional one-sentence description and an optional key chip, and the key chip always matches what the key really does.
- **Disabled reasons.** A disabled control stays hoverable and its Tooltip says why it is disabled ("There is no Frame to remove.", "There are no beads to fit.", "Turn off Row progress to change the Frame.").
- **Notes.** Helper text that was hidden behind an (i) button is always visible as a thin gray Note.
- **Keys.** `Del` empties the Selection, `Shift+Del` removes a whole selected row or column, and `Shift+R` rotates. One `P` key and one control turn Row progress on and off, and on a phone the Progress bar shows exactly while Row progress is on.
- **New Project form.** It no longer asks for a size. The Frame section sets it, in beads or mm, labelled Width and Height.
- **Shared code.** Behind the scenes, one control registry defines each action's name, description, key, enabled state and disabled reason, and the keyboard handler is built from it. Four shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`) and a `Note` replace the per-place copies.

## User Stories

1. As a maker, I want every icon-only control to show its name when I hover it, so that I can learn the interface without pressing things to find out.
2. As a maker, I want the Tooltip to show the control's key as a chip, so that I learn the shortcuts while I work.
3. As a maker, I want the key chip to always do what it shows, so that I can trust it.
4. As a maker, I want a one-sentence description only where the name alone isn't enough, so that Tooltips stay short.
5. As a maker, I want the same control (for example Paint, Rotate or Set Frame) to show the same Tooltip in the Toolbox, the phone sheets, the Dock and the ContextBar, so that I don't have to relearn it on another screen size.
6. As a maker, I want a disabled control's Tooltip to tell me why it is disabled, so that I know what to do to enable it.
7. As a maker, I want Remove Frame to say "There is no Frame to remove." when there is none, so that I understand why nothing happens.
8. As a maker, I want Fit to drawing to be disabled with "There are no beads to fit." on an empty canvas, so that I don't press it for nothing.
9. As a maker, I want Rotate, Remove Frame, Fit to drawing and the size steppers to say "Turn off Row progress …" while Row progress is on, so that I understand the lock.
10. As a maker, I want Rotate to say "Set a Frame first." without a Frame, so that I know what's missing.
11. As a maker, I want Undo and Redo to say "Nothing to undo." and "Nothing to redo." when disabled, so that the state is clear.
12. As a maker, I want Copy to say "Select an area first." and Paste to say "Copy an area first." when disabled, so that I know the order of steps.
13. As a maker, I want Remove row/column to say "Select one whole row or column first." when the Selection isn't a single whole line, so that I don't expect it to remove an arbitrary area.
14. As a maker, I want disabled controls to stay reachable by keyboard focus, so that I can read their reason without a mouse.
15. As a maker on a touch device, I want a long press to show the Tooltip, so that I get the same help as on a desktop.
16. As a maker, I want the Tooltip to be light and slightly see-through but always readable, so that it doesn't hide the beads behind it more than needed.
17. As a maker using High contrast, I want the Tooltip fully opaque, so that its text keeps maximum contrast.
18. As a maker, I want the Tooltip never to be cut off by a column, sheet or screen edge, so that I can always read it.
19. As a maker, I want labelled buttons such as New Project or Import a file to show a Tooltip only when it adds something ("Start an empty canvas."), so that I'm not shown the label twice.
20. As a maker, I want all Tooltip text in one style (sentence case, product nouns capitalized, full stops, no "Click to"), so that the app reads as one voice.
21. As a maker reading in Russian, I want every Tooltip, description and disabled reason in Russian, so that the help is complete in my language.
22. As a maker, I want the size estimate always visible as a short gray Note, so that I don't have to click an (i) to read it.
23. As a maker, I want the Bead quantities explanation always visible as a Note, so that I see how the weight is worked out.
24. As a maker, I want `Del` to empty the selected beads, so that the key does what its name says.
25. As a maker, I want `Del` never to switch me to the Eraser, so that a stray press doesn't change my tool.
26. As a maker, I want `Del` to do nothing when there is no Selection, so that it never erases anything unexpectedly.
27. As a maker, I want `Shift+Del` to remove the selected whole row or column and close the gap, so that I can edit the Frame's size quickly.
28. As a maker, I want `Shift+R` to rotate the Frame, so that I can rotate without the mouse.
29. As a maker, I want Clear to have no key, so that one stray keystroke can never start clearing the whole canvas.
30. As a maker, I want `R` for Rulers and `D` for Row direction shown in their Tooltips, so that I find them.
31. As a maker, I want the Row done and Row not done Tooltips to show both of their keys, so that I can use whichever is comfortable.
32. As a maker, I want Done, Cancel and Clear selection to show `Escape`, so that I know `Escape` backs out of whatever I'm doing.
33. As a maker, I want the Keyboard shortcuts dialog to list exactly the keys the app has, so that it is never out of date.
34. As a maker on a phone, I want the Zoom pill's Row progress button to turn Row progress on and off, so that there is one control for one thing.
35. As a maker on a phone, I want the Progress bar to show exactly while Row progress is on, so that the bar never takes space when I'm not tracking rows.
36. As a maker, I want `P` to do the same as the Row progress switch and the Zoom pill button, so that all three agree.
37. As a maker on a phone, I want the Dock's Tool slot to list the tools in its Tooltip, so that I know what the sheet holds.
38. As a maker on a phone, I want the Dock's Frame slot Tooltip to list "Set Frame, Rotate, Copy, Paste.", so that I know where those live.
39. As a maker on a phone, I want the Project and Menu Tooltips to list what they open, so that I find settings without opening every sheet.
40. As a maker, I want a palette swatch's Tooltip to say "Color", the hex and its key chip, so that I can pick it by keyboard.
41. As a maker, I want Image colors and Canvas color swatches to show "Color" and the hex, so that all swatches read alike.
42. As a maker, I want the remove × on an added swatch to be a small round × in its top-right corner that stays readable on light and dark colors, so that I can remove it without hunting.
43. As a maker, I want the remove × to be easy to hit on touch, so that I don't select the swatch by mistake.
44. As a maker, I want Custom color to tell me the Palette's added-color limit, and say when the Palette is full, so that I know why no more colors are added.
45. As a maker, I want Image colors to say "This Project was not made from a picture." when disabled, so that I understand why it's empty.
46. As a maker, I want the Frame number chip to say "Frame 1" and "Bring it into view.", so that I know it scrolls to the Frame.
47. As a maker, I want the Fit zoom button to say "Zoom to fit everything.", so that I tell it apart from Fit to drawing.
48. As a maker, I want Canvas color to say "Set the background color.", so that I know it doesn't change beads.
49. As a maker, I want Save Project to show `Ctrl/Cmd+S` and "Save to a file on this device.", so that I know where my work goes.
50. As a maker, I want Name on exports' Change button to say what the name is for, so that I know it's printed on exports.
51. As a maker, I want Convert image to say "Turn a picture into a Pattern.", so that I know what it does before picking a file.
52. As a maker, I want the theme options' Tooltips to name each option (Match device, Light, Dark, High contrast), so that the icons are clear.
53. As a maker, I want the New Project form not to ask for a size, so that I start drawing straight away and set the Frame later.
54. As a maker, I want to switch the Frame section between beads and mm, so that I can think in either unit.
55. As a maker, I want my unit choice remembered on this device, so that I don't switch it every time.
56. As a maker, I want a typed mm size always rounded up to the next whole bead, so that the piece is never smaller than I asked.
57. As a maker, I want the steppers to add or remove one bead at a time even in mm, so that each press is predictable.
58. As a maker, I want the Estimated size to show the other unit (mm when I work in beads, beads when I work in mm), so that I see both.
59. As a maker, I want sizes labelled Width and Height everywhere, so that I don't confuse rows to weave with the Frame's size.
60. As a screen-reader user, I want every control to keep its accessible name, so that the visual Tooltip never replaces the announced name.
61. As a screen-reader user, I want disabled controls announced as disabled and still reachable, so that I can find out why.
62. As a screen-reader user, I want menu buttons to announce whether they're expanded, and focus to return to the button when the popover closes, so that I don't lose my place.
63. As a developer, I want each action defined once in the control registry, so that a name, description or key changes in one place.
64. As a developer, I want the keyboard handler built from the registry, so that a key chip can never disagree with the key.
65. As a developer, I want a test that fails when two actions use the same key or combination, so that a key clash is caught before it ships.
66. As a developer, I want the type of a disableable control to require a `disabledBody`, so that I can't forget the reason.
67. As a developer, I want a test that fails when an action lacks an English or Russian name, so that translations can't be skipped.
68. As a developer, I want one `IconButton`, one `AppButton`, one `MenuButton` and one `Swatch`, so that I don't copy markup per screen size.
69. As a developer, I want no native `title` attributes left in the app, so that hover help has one mechanism.
70. As a developer, I want the old `ToolButton`, `ExpandButton`, `AppLink` and the hand-built (i) popups deleted, so that nobody uses them again.
71. As a design-system owner, I want the Tooltip, Note, Swatch and Button cards updated in the same change as the code, so that the repo's design system stays the source.

## Implementation Decisions

- **Control registry** (new, deep module). One definition per action: id, icon, name (English and Russian), optional body, zero or more keys, an enabled check, a `disabledBody` (which may depend on the reason: no Frame, Row progress lock, empty canvas) for any action that can be disabled, and the command it runs. The Toolbox, phone sheets, Dock, ContextBar, Zoom pill, Progress bar, header, Menu and the Keyboard shortcuts dialog read from it.
- **Keyboard handler** is built from the registry's keys. Rule: one key or combination maps to exactly one action. One action may have several keys. Several controls may display the same action's key: `Escape` is one Back out action (Frame editing, then paste, then Selection, then Paint) shown on Done, Cancel and Clear selection. Dialogs keep the browser's own `Escape` for closing, outside the registry. The existing guards stay: no modal open, not while typing (except Save), and Enter/Space giving way to a focused Toolbox button.
- **Key changes:**
  - `Del` empties the Selection's beads and does nothing without a Selection. It never picks the Eraser.
  - `Shift+Del` runs Remove row/column.
  - `Shift+R` runs Rotate.
  - Clear has no key.
  - `P` is the one Row progress action.
- **Row progress on phones (under 1024px):** the Zoom pill's button is the same action as the Progress bar's switch. Turning it on turns Row progress on and shows the bar. Turning it off turns Row progress off and hides the bar. The separate "show the Progress bar" preference is removed. From 1024px up the bar stays always visible, as now.
- **Tooltip contract** (`AppTooltip`): `name` is required; `body` and `hotkey` are optional; `disabled` and `disabledBody` go together, and the types require `disabledBody` whenever `disabled` can be true. When disabled it shows the name and `disabledBody` in muted text, with no key chip. A control shows a Tooltip exactly when one is given to it. Opening it, the top-layer placement and the 15rem wrap stay as in ticket 265.
- **Tooltip look:** the `elevated` surface at about 90% opacity with a backdrop blur, `ink` text, a 1px `line-soft` border and the existing shadow token. Fully opaque in High contrast. It must pass WCAG 4.5:1.
- **Disabled controls** use `aria-disabled="true"` instead of the native `disabled`. They stay focusable and hoverable, and activating them does nothing.
- **Shared controls:**
  - **`IconButton`:** icon, size, optional key badge (`hotkey` and `showHotkey`), selected state, optional Tooltip, or a registry action. It absorbs ToolButton (the underline when selected and the key badge), ExpandButton, the Dock slots, sheet close and the steppers.
  - **`AppButton`:** optional leading icon, label, variants, and a new `link` variant replacing AppLink. Optional Tooltip, or a registry action.
  - **`MenuButton`:** wraps either of the above and opens a popover on desktop or a sheet on a phone. It owns `aria-expanded`, `aria-haspopup`, focus return, and closing on `Escape` or an outside click. Its Tooltip body can be generated from its item names ("A, B, C.").
  - **`Swatch`:** a color, selected state, an optional key chip, and an optional remove ×. The × is round, top-right inside the swatch, with no background, drawn in `ink` or `canvas` (whichever contrasts more with the swatch, the same logic as the Bead cursor). It is about 10px with a hit area of at least 24×24. The Tooltip is "Color" with the hex as the body.
  - **`Note`:** always-visible helper text on a gray surface, in `meta` type and muted, with no icon.
  - **Kept as they are, wired to the Tooltip:** AppSwitch, SegmentedControl/ThemeToggle, Stepper.
- **Copy:** the full English and Russian table is in ticket 334. Rules: the name is the control's existing name in sentence case with product nouns capitalized; the body is one imperative sentence with a full stop; keys appear only in chips; never "Click to"; lists are built from item names. Controls the buttons audit marks "none" keep only their accessible name.
- **New Project form** loses its Frame, Unit and Width & Height sections. The Frame section gains a beads | mm switch remembered on the device. A typed mm value rounds up to the next whole bead. A stepper press is one bead in either unit. Estimated size shows the other unit. Width and Height replace columns and rows wherever a Pattern size is shown. Convert image keeps its own size step (ADR 0026).
- **Design system:** the Tooltip, Note, Button, PaletteSwatches, Frame, NewPatternForm and NumbersAndUnits cards are updated in the same changes as the code (DESIGN.md §6), using role-named tokens only.
- **Order:** 327, 328, 329 and 342 can start at once. 330 and 331 follow 327 and 329. 332 follows 330 and 331. 333 follows 327, and 334 follows 329. The migrations (335 Toolbox → 336 Dock and phone sheets → 337 ContextBar → 338 Zoom pill, canvas strip and Canvas color → 339 Progress bar → 340 header, Menu and Overview → 341 Save box, Saved Projects, dialogs and toasts) run one after another. 341 deletes the old components and the last `title`s.

## Testing Decisions

- **What makes a good test:** it checks what a maker can observe (the key pressed changes the canvas or tool, the Tooltip shows this name, body and chip, a disabled control does nothing and gives its reason), not internal structure or class names beyond what the existing tests already pin.
- **Seam 1, the registry through the keyboard handler** (the main seam; prior art is the existing shortcut-table tests):
  - Pressing a key runs its action, covering `Del` with and without a Selection, `Shift+Del`, `Shift+R`, `P`, `Escape`'s back-out order, and the keys that must not change.
  - Checks over the whole registry fail on a duplicate key or combination, a missing English or Russian name, or a disableable action without a `disabledBody`.
- **Seam 2, the shared controls mounted** (prior art: the existing UI controls test file):
  - The Tooltip's name, body and chip; the disabled name, `disabledBody` and no chip; `aria-disabled`, and a click doing nothing.
  - `MenuButton`'s `aria-expanded` and where focus goes when it closes.
  - The `Swatch` × showing only on a selected added color.
  - The `Note` rendering its text.
  - The unit rule: rounding up from mm and one bead per stepper press.
- **Seam 3, the visual check** (existing Playwright visual suite, run by CI):
  - The new Tooltip look in all themes, the Note, the Swatch ×, the Frame section's unit switch, and each migrated area.
  - Baselines are updated only where the look changed on purpose.
- **Area tests:** the existing Toolbox, Dock, ContextBar and phone sheet tests are adjusted, not duplicated. Following ticket 253, no new app-level tests.
- **A no-`title` check:** a lint rule or a grep in CI fails if a native `title` attribute appears in the app's components.
- While implementing, run only the related tests (`vitest related`). CI runs the full gate.

## Out of Scope

- Scoped keys (the same key meaning different things in different modes).
- New keys other than `Shift+Del` and `Shift+R`, and any key for Clear.
- A redesign of Convert image beyond keeping its size step.
- Units other than beads and mm (cm and inches).
- Tooltips for controls the audit marks "none": menu items, Language switcher, Export menu items, dialog buttons, toast actions, Overview controls, Saved Projects remove × and Export project/library.
- The Tour, which is switched off.
- A UI-scale preference.

## Further Notes

- The domain language is in CONTEXT.md: the Tooltip, Note, Eraser, Remove row/column, Rotate, Pattern size, Zoom pill, Progress bar and Set Frame entries were updated in this session.
- There are no users yet, so no stored-settings migration is needed for the removed "show the Progress bar" preference beyond ignoring it.
- The Russian copy in ticket 334 is a draft for human review.
- Row progress (the switch, the Zoom pill button and `P`) is disabled while there is no Frame, with "Set a Frame first."; the Progress bar still offers Set Frame.
