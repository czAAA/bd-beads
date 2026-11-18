# How the app builds the Homepage

The Homepage card (`docs/design/system/components/Homepage/README.md`) describes the page (ticket 0739); this file says how the app builds it. Moved out of `DESIGN.md` §4.7, which keeps a one-line entry. Paths are under `src/`; `inside/` is `src/homepage/inside/`.

- The Homepage is the main address and the editor is `app/` under it (ticket 1052, ADR 0097): two built pages, the
  root `index.html` and `app/index.html`. `homepage/homepageRoute.ts` holds both addresses and the one rule between
  them: a tab's first page at the main address goes on to the editor when the device holds Projects
  (`shouldOpenEditor`, asked by `homepage/homepage.ts` after the count); once a tab has shown either page
  (`markArrived`) the main address stays the Homepage. The editor never sends anyone here.
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
  own px (the zoom and the section's turn scale divided out); it starts with as many whole rows as fit the room
  (`freeStartRows`, ticket 1060), never fewer than `--free-start-rows`. The rows come from `homepage/freeList.ts`: the
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
- The page carries its own words for crawlers that never run the app (ticket 1055): `homepage/pageCopy.ts` gathers the
  title (`homepageTitle`, which the tab shows too), the description and the copy a new visitor sees, from the functions
  the sections draw from (`welcomePromises`, `insideChapters`, `freeListGroups`), and the build writes them into
  `index.html` (`vite.crawler.ts`; `docs/deploy.md`, What crawlers read). A section's new copy reaches the page only
  when `pageCopy.ts` takes it, and only copy the drawn page shows belongs there.
- Each language has its own addresses (ticket 1053): `/ru/` is the Homepage and `/ru/app/` the editor in Russian, built
  by `vite.crawler.ts` for every language (`docs/deploy.md`, What crawlers read). `i18n/addressLocale.ts` reads the
  code: `followAddressLocale`, called by `homepage/homepage.ts` and `main.ts` before the language loads, makes it the
  device's saved language and from then on changes the code in place (`history.replaceState`, no reload) when the
  Menu's switch changes the language. An address with no code uses the saved language and is never changed; the
  installed app starts at `/app/`. Every link between the pages is built on `pagesBase()`, the address's language
  folder, so the way in from `/ru/` opens `/ru/app/` (its own addresses, `?project=` and the rest, after it) and the
  Menu's Homepage and the Wordmark lead back to `/ru/`. The pages' first script keeps a language page's `lang`
  (`data-locale`), so it never flashes the saved one. `npm run dev` serves `/ru/app/` as `/app/`.
- A shared link shows a card (ticket 1056): each language's Homepage and editor carry Open Graph and Twitter card tags
  with the Homepage's own title and description and a picture of its Welcome, `public/previews/welcome-<code>.png`
  (1200 × 630). The pictures are screenshots of the real Homepage on a new device in the light theme, never drawn by
  hand: after a change to how the Welcome looks or reads, run `npm run store:images` (`e2e/store/storeImages.spec.ts`;
  `docs/deploy.md`, The installed app's icons and screenshots), look at them and commit what changed.
