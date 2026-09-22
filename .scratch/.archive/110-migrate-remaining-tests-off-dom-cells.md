# 110: Migrate the remaining suites off DOM cells

**What to build:** The other test suites that find beads as DOM elements stop doing so and assert the same behaviours through the renderer path: the grid and canvas component tests (about 40 references), the Mirror suite (about 24), and the Resize and Convert image App-level suites (a handful each). This is the second batch of the expand–contract sequence (the first is 109); the DOM grid still exists while both move.

**Blocked by:** 108 (Renderer becomes the default, and the cap goes)

**Status:** done

- [x] Every test in the grid component, canvas component, Mirror, Resize and Convert image suites that finds beads, rows, preview markers or axis lines as DOM elements is re-expressed on the renderer path
- [x] No behaviour test is deleted without an equivalent, and any behaviour that lost coverage is named in this ticket and closed
- [x] The suites are green and none depends on the temporary switch
- [x] Tests that only ever checked how the old grid was built out of elements (rather than what the person sees or can do) are removed, each with a line in this ticket saying what behaviour, if any, they were standing in for

## How it came out

The Mirror suite (`App.richMirror.test.ts`, 29 references: axis lines, the "Mirror current" dimming, copy mode, paste through Mirror), the Resize suite (`App.resize.test.ts`), the Convert image suite (`App.convertImage.test.ts`), the Save/QR suite (`App.saveAndQr.test.ts`) and the canvas component's (`PatternCanvas.test.ts`) run on the renderer through ticket 109's helper, none deleted, all green: axis lines are `mirrorAxes` (the count of lines the surface draws in each direction, the hover-preview axis included), the dimmed beads are `dimmedBeads`, the bead totals after a Resize are `drawnPattern`'s size, the created Pattern's colors are `beadColor`. The canvas component's forwarding tests (a press, a right press, hover and hover-end reach the parent as the same six events) press beads on the surface. Nothing depends on the temporary switch any more; `testSetup.ts` no longer starts tests on the DOM grid (ticket 108's stopgap) and `PatternCanvas.test.ts` no longer builds a DOM grid to compare with.

**The grid component's own tests (`PatternGrid.test.ts`, 40 tests) are removed**, because they test the DOM component that ticket 111 deletes, and each behaviour in them has an equivalent on the renderer path (three needed one added, marked +):
- one row per Pattern row and a cell per column; loom rows not offset; peyote's alternate rows half a bead across and packed tighter; brick stitch's stagger (a seam apart now, see ticket 67): `patternRenderer.test.ts` "Technique geometry" and "places … beads" (positions of every bead per Technique), `hitTest.test.ts`.
- cell-primary-down / -move / secondary-down / -move / hover / hover-end with the row and column, for mouse, touch and pen, and the native menu suppressed: `PatternSurface.test.ts` "the pointer" (+ a touch and a pen stroke continuing as a held mouse does, ticket 60's test) and `hitTest.test.ts`.
- hover preview (nothing when none, the color faintly, a neutral outline with none, every given bead such as the mirrored counterparts, each bead of a pasted block in its own color): `overlayRenderer.test.ts` "the hover preview" and `PatternSurface.test.ts` "the hover preview".
- Row progress (nothing marked while off, rows behind the pointer dimmed and the current one marked, nothing woven while on the first row +, columns dimmed bead by bead with the current column marked, no row overlay in the column direction): `patternRenderer.test.ts` "finished rows" (both directions) and `overlayRenderer.test.ts` (the marker for a row and for a column, per Technique).
- Selection (no marquee without one, exactly the beads inside the rectangle, the outline only along its edge): `overlayRenderer.test.ts` "the Selection" (wash on each bead, outline on the edge beads, culled to the screen).
- Mirror axis lines (none while both counts are 0, one per axis in every Technique +) and the "Mirror current" dimming (exactly the given beads, none when empty): `overlayRenderer.test.ts`.
- Tests that only checked how the old grid was built out of elements, with no behaviour of their own: margin-left and margin-top values of row elements, CSS class names on rows and cells, and "renders nothing extra" — standing in for the Technique's geometry and the marker's look, both now pinned in numbers by the renderer and overlay tests.
