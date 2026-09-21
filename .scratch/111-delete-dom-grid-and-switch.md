# 111: Delete the DOM grid and the temporary switch

**What to build:** The "contract" step: with every batch of tests migrated (109, 110), the one-element-per-bead grid and the temporary development switch that chose between it and the renderer are deleted. After this the Pattern is drawn one way only, by the Pattern renderer, and there is no path that renders a Pattern as DOM elements.

**Blocked by:** 109 (Migrate the App-level tests off DOM cells), 110 (Migrate the remaining suites off DOM cells)

**Status:** ready-for-agent

- [ ] The DOM grid's cell rendering and the temporary switch are removed, along with the styles and test identifiers that existed only for them
- [ ] No reference to the removed elements remains in the source or the tests
- [ ] The whole suite is green, including ticket 103's visual check against the reference screenshots and its compatibility test
- [ ] The performance check is re-run and the final numbers are recorded in this ticket: on the floor (4× CPU slowdown) at least 30 fps for hover and paint at 70×250 and 250×250
- [ ] CONTEXT.md and ADR 0018 still describe what the code does
