# 110: Migrate the remaining suites off DOM cells

**What to build:** The other test suites that find beads as DOM elements stop doing so and assert the same behaviours through the renderer path: the grid and canvas component tests (about 40 references), the Mirror suite (about 24), and the Resize and Convert image App-level suites (a handful each). This is the second batch of the expand–contract sequence (the first is 109); the DOM grid still exists while both move.

**Blocked by:** 108 (Renderer becomes the default, and the cap goes)

**Status:** ready-for-agent

- [ ] Every test in the grid component, canvas component, Mirror, Resize and Convert image suites that finds beads, rows, preview markers or axis lines as DOM elements is re-expressed on the renderer path
- [ ] No behaviour test is deleted without an equivalent, and any behaviour that lost coverage is named in this ticket and closed
- [ ] The suites are green and none depends on the temporary switch
- [ ] Tests that only ever checked how the old grid was built out of elements (rather than what the person sees or can do) are removed, each with a line in this ticket saying what behaviour, if any, they were standing in for
