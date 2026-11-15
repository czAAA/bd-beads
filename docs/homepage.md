# How the app builds the Homepage

The Homepage card (`docs/design/system/components/Homepage/README.md`) describes the page (ticket 0739); this file says how the app builds it. Moved out of `DESIGN.md` §4.7, which keeps a one-line entry. Paths are under `src/`; `inside/` is `src/homepage/inside/`.

- The page (`position: fixed`, `overflow: hidden`) never scrolls: the stage holds the canvas box in its middle, and
  the section shown is a ref that every way of turning sets (ticket 0801). `homepage/useSectionInput.ts` turns wheel,
  trackpad, swipe and keys into turns, a section taller than its room scrolling inside itself first; the wheel's
  gestures are `homepage/wheelTurn.ts`, the keys `homepage/sectionKeys.ts`. It was a snapping scroller with a sticky
  stage until ticket 0801, but Chrome re-snaps a snap container whenever layout inside it changes, and What's inside's
  playing editor changes it many times a second, so scrolls were pulled back; don't bring native snapping back.
- Its bottom bar is the editor's `ProgressBar` with the sections in its slot, and `ProgressTrack`, the track and spark
  Row progress draws, with Pattern done's burst at its end: one component, not a copy.
- The free list grows with the plans section's own scroll (tickets 0742, 0801). The section scrolls on by the room the
  whole list needs (an absolute spacer, `.homepage__free-room`, so the growing list doesn't change the scroll range),
  its content scrolling up natively, and the list is as tall as
  `homepage/freeGrowth.ts` says, measured by `useFreeGrowth` from the section, the list and the tile in the section's
  own px (the zoom and the section's turn scale divided out). The rows come from `homepage/freeList.ts`: the
  Techniques from `TECHNIQUES`, the brands from the offered Beads' catalogs, the codes counted from the catalog files
  at build time (`__COLOR_CATALOG_CODES__`, so the Homepage fetches no catalog), the Starters from `categories.json`.
- The two X1 marks are `AppLogo`, the design system's own file.
- Welcome is the first of four sections (ticket 0830; `homepage/sections.ts` lists them, and the bar counts what it
  lists). `WelcomeTile` takes its counts from the app (`homepage/appCounts.ts`: the catalogs' codes and the Starters,
  as the free list counts them) and its piece from the Project renderer (`WelcomePiece`, the tour's peacock cuff from
  `inside/demoProjects.ts`, drawn in the theme shown), so neither is a number or a picture kept by hand. The feather
  is data (`inside/peacock.ts`, ticket 0831): the ring's eye, the cuff, the reference picture (`peacockPicture.ts`) and
  the strokes and Fills that trace it (`peacockTrace.ts`) all come from the one formula, so they cannot drift apart. The way into
  the editor is the page's one primary button: `StepBar`'s `nextVariant` makes the Homepage's Next secondary, and
  Convert image's stays primary.
- What's inside is a real editor (`inside/InsideShell`, the app's shell given its own stores), played by a tour
  (`inside/useInsideTour.ts`: 13 rows, `inside/tourScripts.ts`) and shown as four chapters (`inside/insideCopy.ts`).
  A row pressed applies the rows before it at once, so every chapter starts on what the ones before it made. The list
  stands beside the demo from a 1000px homepage box (`LIST_FROM` in `HomePage.vue`, by the zoomed width) and is a band
  over it under that. Expand is the page's control drawn in the demo's own Canvas strip: the shell passes it through
  (`demo.expand` in `useAppShell`), and `composables/ui/shellScope.ts` (`pagesOwn`) keeps a press on it from taking the
  editor over or closing its popovers.
- The step names are measured, not counted (`StepBar`): where two would come closer than 6px only the current one
  shows, the others on hover or focus.
