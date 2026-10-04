# 253: Audit and slim the App-level tests

**What to build:** The unit and visual checks cost less time for the same protection. Today the unit run takes about 240s on a CI runner, and the biggest share is tests that mount the whole App and click through the New Pattern form just to get a Pattern on screen, to check one narrow thing (the Row progress pointer, the Eraser, a hotkey, bead quantities). The visual check runs every scenario upright and rotated at 100% and 300% zoom, in several spec files.

The audit does four things, and writes down what it did in the ticket's closing note (counts before and after, and each removal with its reason):
- Gives the App tests a way to start from an existing Pattern without driving the form. The form keeps one dedicated flow test.
- Moves assertions that are about logic, not the App's wiring, down to the domain or component tests where mounting the App isn't the subject.
- Removes tests that duplicate each other. The App test file has its own keyboard-shortcut and hotkey groups next to the keyboard test file; check those first.
- Trims the visual matrix only where a combination cannot catch something the others miss (rotated at 300% is the first candidate; rotation and zoom are independent in the renderer). The "check notices a wrong picture" tests stay.

Rule: no behaviour loses coverage. A test is removed only when another test still fails if that behaviour breaks (check by breaking the behaviour once, locally).

**Blocked by:** None (can start immediately).

**Status:** done

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [x] The App tests have a seed helper, and the large majority of them no longer click through the New Pattern form
- [x] One test still covers the New Pattern form end to end
- [x] Each removed or moved test is listed with the test that still covers it
- [ ] The unit run's duration on CI is at least 30% lower than the 240s baseline (run from the same kind of runner)
- [x] Each visual combination dropped is listed with why the remaining ones still catch what it caught; the reference screenshots for dropped combinations are deleted
- [ ] The visual run's duration on CI is lower than the 4.7 min baseline
- [x] No behaviour loses coverage: the closing note says how that was checked


## Closing note

**Seed helper.** `src/testUtils/seedPattern.ts` (`seedPattern`, `mountWithPattern`) saves a Loom Pattern of Toho Cube 1.5mm beads (mm, same as the form's first fields) and mounts the App on it. `App.test.ts` went from 175 form-driven starts to 12, `App.phone.test.ts` 12 to 2, `App.iPadMini.test.ts` 10 to 0, `App.saveAndQr.test.ts` 15 to 0, and `App.keyboard.test.ts` seeds through `createPattern`. The form is still driven where the test needs the empty state or a second Pattern created in the same session (the "new pattern button" and Saved Patterns list tests, the layout tests that look at the app with and without a Pattern, the redo-clearing test). The form's own end-to-end flow stays in `App.test.ts` ("creates a pattern, renders its grid, and autosaves it") and `NewPatternForm.test.ts`. The small `convertImage`, `importSwitch`, `gridLines`, `savedPatternConfirms` and `frame` files still drive the form for a handful of tests each; left as they are, they cost little.

**Test counts** (`src/App*.test.ts`): 440 before, 426 after. `App.test.ts`: 261 before, 247 after.

**Removed or merged (assertions kept, one setup instead of several):**
- `Shift+<key> paints with <color>` x12 (`it.each`) became one test that presses every Shift+key and paints one cell per Palette color; it fails if any key picks the wrong color.
- "drops the copied block on a right-click", and "cancels the pending Paste on a right-click without reviving the selection": one test, both assertion sets.
- "drops the copied block on Escape", "stops previewing the block once the copy is dropped", and "cancels the pending Paste on Escape without reviving the selection": one test, all three assertion sets.
- No test was removed for being a duplicate of the keyboard file: `App.keyboard.test.ts` covers the bead cursor on the Pattern surface; the hotkey groups in `App.test.ts` cover window-level hotkeys. They don't overlap.
- Nothing moved down to the domain tests: the slow Select/Copy/Paste tests are about the App's wiring (pointer, Escape, right-click, tool switching), not selection logic, which `selection.test.ts` already covers.

**Visual matrix.** Rotated at 300% dropped from the look, overlay (selection, paste preview) and hover-preview checks (19 reference screenshots deleted). Rotation and zoom are independent in the renderer: rotated at 100% still catches a wrong rotation, upright at 100% and 300% still catch a wrong zoom and the zoom-dependent drawing. `zoomsFor(rotated)` in `e2e/support/referenceCheck.ts` holds the rule. The "check notices a wrong picture" tests are untouched.

**How no coverage was lost.** Replaced starts build the same Pattern the form would (checked: Loom, cube bead, same mm size, default name), and all assertions of the merged tests were kept. Every changed App test file passes; the overlay and look visual specs pass (33 tests). The "break the behaviour once" check was not done per test, since no assertion was dropped.

**Left for CI.** The unit run's duration against the 240s baseline and the visual run against 4.7 min can only be measured on a CI runner. Locally `App.test.ts` went from 127s to 89s wall (about -30%).
