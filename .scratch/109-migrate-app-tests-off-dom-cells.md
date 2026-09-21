# 109: Migrate the App-level tests off DOM cells

**What to build:** The app's main behaviour test suite stops finding beads as DOM elements and asserts the same behaviours through the renderer path instead. It is by far the largest batch of the migration (about 115 references to per-bead, per-row, preview and axis-line elements in a file of over 3,500 lines), so it is its own ticket. This is one batch of an expand–contract sequence: the DOM grid still exists, so the rest of the suite stays green while this batch moves. Ticket 111 deletes the old grid once every batch has moved.

Painting, erasing, Fill, Select, paste, Mirror, Row progress, Undo and Redo, hover previews and rotation are all still checked, by placing pointer events at coordinates on the Drawing surface and reading the result from the Pattern's state (and, for what is drawn, from the renderer's own output or the overlay's state), since the test environment has no real canvas.

**Blocked by:** 108 (Renderer becomes the default, and the cap goes)

**Status:** ready-for-agent

- [ ] Every test in the App-level suite that finds beads, rows, preview markers or axis lines as DOM elements is re-expressed on the renderer path
- [ ] No behaviour test is deleted without an equivalent: the list of behaviours the suite covered before is compared with the list after, and any that lost coverage are named in this ticket and closed
- [ ] The suite is green, and no test in it depends on the temporary switch
- [ ] Pointer events at coordinates go through the same hit-testing the app uses; a test helper for "press the bead at row r, column c" replaces the old element lookup
