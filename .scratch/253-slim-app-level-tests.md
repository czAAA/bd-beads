# 253: Audit and slim the App-level tests

**What to build:** The unit and visual checks cost less time for the same protection. Today the unit run takes about 240s on a CI runner, and the biggest share is tests that mount the whole App and click through the New Pattern form just to get a Pattern on screen, to check one narrow thing (the Row progress pointer, the Eraser, a hotkey, bead quantities). The visual check runs every scenario upright and rotated at 100% and 300% zoom, in several spec files.

The audit does four things, and writes down what it did in the ticket's closing note (counts before and after, and each removal with its reason):
- Gives the App tests a way to start from an existing Pattern without driving the form. The form keeps one dedicated flow test.
- Moves assertions that are about logic, not the App's wiring, down to the domain or component tests where mounting the App isn't the subject.
- Removes tests that duplicate each other. The App test file has its own keyboard-shortcut and hotkey groups next to the keyboard test file; check those first.
- Trims the visual matrix only where a combination cannot catch something the others miss (rotated at 300% is the first candidate; rotation and zoom are independent in the renderer). The "check notices a wrong picture" tests stay.

Rule: no behaviour loses coverage. A test is removed only when another test still fails if that behaviour breaks (check by breaking the behaviour once, locally).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [ ] The App tests have a seed helper, and the large majority of them no longer click through the New Pattern form
- [ ] One test still covers the New Pattern form end to end
- [ ] Each removed or moved test is listed with the test that still covers it
- [ ] The unit run's duration on CI is at least 30% lower than the 240s baseline (run from the same kind of runner)
- [ ] Each visual combination dropped is listed with why the remaining ones still catch what it caught; the reference screenshots for dropped combinations are deleted
- [ ] The visual run's duration on CI is lower than the 4.7 min baseline
- [ ] No behaviour loses coverage: the closing note says how that was checked
