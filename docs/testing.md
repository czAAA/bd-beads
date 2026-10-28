# Testing

How tests are written in this repo. The commands are in the README's Checks; the review rules are in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md).

## Running them

- While working, run only the tests related to your change: `npm run test:related -- <changed files>`. It runs `vitest related` with the `agent` reporter and `--silent=passed-only`, so a green run prints a few lines, and it leaves out the `App.*.test.ts` files: the App imports everything, so almost any UI change would pull in all 19 of them (about 4 min of CPU on the Pi). The full unit suite peaks near 2 GB of RAM (summed over its worker processes, the largest about 0.8 GB; measured after tickets 420 and 422), so on a slow machine its one run is CI's, on every pull request, even where a skill says to run it at the end (`CLAUDE.md`, Context hygiene). `npm run test:full` makes that machine-dependent: before a pull request opens it runs the whole suite (`agent` reporter, `--silent=passed-only`) when the machine has at least 8 cores and 8 GB (available on Linux, total on macOS) and prints a skip line otherwise. `BD_FULL_TESTS=1` forces the run, `BD_FULL_TESTS=0` forces the skip. CI stays the gate either way.
- Add an App file to the command (`npm run test:related -- src/ProgressBar.vue src/App.canvas.test.ts`) only when your change touches the App's wiring: a shell, a keyboard shortcut, a flow that spans components. It is then run on its own, in the same quiet mode.
- `npm run typecheck` and `npm run lint` are cheap; run them before pushing.

## CI

CI (`.github/workflows/ci.yml`) is the gate: every pull request to `main` runs typecheck, lint and knip, the unit tests (Vitest shards), the browser component tests (Vitest shards too; `--shard` splits by file) and the visual check (Playwright shards over one shared build). GitHub is the proof a change passed; nothing rests on a habit on one machine.

- Each suite ends in one job with a stable name, and branch protection requires those three: "Typecheck and lint", "Unit tests passed", "Visual check passed". The shard counts can change in `ci.yml` without touching branch protection.
- A pull request that changes only Markdown is skipped by `paths-ignore`, so its required checks never start and it waits forever: merge it with an admin override.
- The workflow uses `pull_request` (never `pull_request_target`), a read-only token and no secrets, and pins every action to a commit SHA.
- The browser component and visual jobs run in the `mcr.microsoft.com/playwright` image (Chromium and its system libraries built in, so no apt install on the runner). Its tag must equal the `@playwright/test` version in `package-lock.json`; bump both together.
- A failed visual shard uploads its `test-results`, and the shards' reports are merged into one HTML report artifact.
- The performance check (`npm run perf`, README) is run by hand, never in CI: its timings depend on an idle machine. What can be counted rather than timed is a unit test instead: how many times a stroke draws and which rows (`ProjectSurface.test.ts`, ticket 0616).

## Where a test goes

- A unit or component test sits beside its file as `<name>.test.ts`.
- Which Vitest project a test runs in (ticket 420) follows from where it sits and what it is called:
  - `page` (jsdom, one page shared by every file a worker runs): anything under `src/components/` or `src/homepage/`, every `src/App*.test.ts`, and any other test that needs a page or its storage (`document`, `window`, `localStorage`, `sessionStorage`, a canvas) named `<name>.dom.test.ts`.
  - `unit` (plain Node, no per-file isolation): everything else. A new domain, rendering or service test needs no setup. If it fails there on `document`, `window` or `localStorage` being undefined, rename it `.dom.test.ts`.
  - `browser` (real Chromium through Vitest browser mode, ticket 552): `<name>.browser.test.ts`, for layout facts jsdom cannot know (text that fits, a Tooltip kept on screen). It mounts one component at a width and language with `mountAt` (`src/testUtils/browserFit.ts`), which loads the app's own styles and fonts, and measures whether its text fits and its Tooltips stay on screen. It runs where Chromium is installed (`npx playwright install chromium`) and skips itself where it is not (the Pi); `BD_BROWSER_TESTS=1` turns a missing Chromium into an error, `=0` skips it. A `.browser.test.ts` is never run by `unit` or `page`.
  - In both, files share one module cache per worker within a project, so keep module state and `vi.mock` inside the file and undo what a test installs on a global (`vi.unstubAllGlobals()`, `vi.restoreAllMocks()`).
- Why sharing: setting up jsdom per file was most of the suite's time. Measured on the Pi with 2 workers (ticket 420), the App files take 217 s wall and 374 s CPU sharing one page per worker and 378 s and 567 s isolated, so they share too.
- Test at the highest seam that already exists for the behavior, through its public interface, and don't add a seam only to reach an internal. Mount the whole App only when the App's wiring is the subject; otherwise test the domain function, the flow composable or the component on its own (ticket 253 moved logic tests down out of the App tests).
- A shell part's wiring (a panel control reaching its flow, the dialog it asks through) is tested by mounting that part under the real wiring with `mountShellParts` (`src/testUtils/shellHost.ts`, ticket 0618), not the App: `AppPanels.test.ts`, `AppDialogs.test.ts`. An App test is left for wiring that spans parts, such as a strip button opening its panel or the canvas reaching a flow.
- An App test proves the wiring (control → flow → storage or screen) with one happy path. Edge cases and every variant (each key, each guard, each label, each tool) live at the lowest level that has them: the shortcut table, the component, the flow. Use one language unless the language switch is the subject; the `Translations` type already makes both languages complete. A mount costs 250–330 ms on the Pi, so every extra App mount is paid by every CI run (ticket 421).
- Assert each behavior at one level only (ticket 0599). The domain test holds the rule (which beads move, what is refused); the flow test what the flow decides (which layer, whether it asks, one Undo step, what it announces); the component test what it shows and emits; an App test only that a control reaches its flow. A test that repeats what a lower level asserts costs lines and run time and catches nothing more; how to cut one safely is in [Cutting tests](#cutting-tests).
- App-level tests are split by area: `src/App.<area>.test.ts`. Add to the file for the area, or start a new one; don't grow `App.test.ts`.

## Prior art to copy

| Kind | Copy | Notes |
|---|---|---|
| Pure domain logic | `src/domain/changeFrame.test.ts` | Plain inputs and outputs, no mounting |
| A flow composable that edits the Project | `src/composables/tools/useRotateSelectionFlow.test.ts` | Drives a real Edit and Undo through `editHarness` |
| A component on its own | `src/components/ui/MenuButton.test.ts`, `src/components/canvas/ProgressBar.test.ts` | `mount` with props, assert on what the person sees |
| The control registry and its keys | `src/composables/shell/controlRegistry.test.ts` | A duplicate key fails here |
| Drawing | `src/rendering/overlayRenderer.test.ts` | `recordingContext` writes down every draw call |
| A shell part's wiring | `src/components/shell/AppPanels.test.ts` | `mountShellParts(AppPanels, AppDialogs)`: the real wiring, no canvas |
| The App's wiring | `src/App.selection.test.ts` | Starts from a saved Project with `mountWithProject` |

## Shared test helpers (`src/testUtils/`)

- `chooseLanguage.ts`: `chooseLanguage(wrapper, 'ru')` opens the Language picker's menu and picks that language (ticket 368).
- `choosePanelOption.ts`: `choosePanelOption(wrapper, testid, value)` picks a value in a Menu PanelPicker; `panelOptionShown` reads the value it shows (ticket 0553).
- `seedProject.ts`: `seedProject` saves a Project, `mountWithProject` mounts the App on it (no form driving), `createProjectViaForm` for the one test that is about the form.
- `editHarness.ts`: a real Edit and Undo history over one in-memory Project, for flow tests (ADR 0036). The Project is a ref, so a flow's computeds follow each Edit.
- `shellHost.ts`: `mountShellParts(...parts)` mounts parts of the shell (AppPanels, AppDialogs) under the app's real wiring and nothing else, and hands back its contexts, `openPanel(panel)` and the dialog registry (ticket 0618).
- `paletteHost.ts`: `mountWithPalette(component, ids, props)` mounts a Palette control under the real Palette and Edit, as the app shell provides them, with spies for asking to remove one color or all (ticket 0601).
- `beads.ts`: press, hover and read beads on a mounted surface (`pressBead`, `hoverBead`, `beadColor`, `beadColors`, `rowProgressView`, `rulerNumbers`, …).
- `fakeCanvas.ts`, `recordingContext.ts`: jsdom has no canvas; these stand in for it.
- `fakeMatchMedia.ts`, `fakeResizeObserver.ts`, `surfaceLayout.ts`: media queries, element sizes and layout a test controls.
- `storageWrites.ts`: count localStorage writes, or make one fail.
- `sharedPage.ts`: what the setup resets before each `page` file, and its never-repeating clock.
- `rotated.ts`: a ready-made rotated Project.
- `frameGrid.ts`: `frameGrid` reads a Project's beads as a dense grid of rows and columns, the shape an expectation is written in, and `withFrameGrid` puts one back (ticket 0609).

App code holds only what the app uses (ticket 0609): `npm run knip`'s second run, `knip --production`, leaves the tests and these helpers out and fails on a file or export only a test reaches. A fixture builder belongs here, not in `src/`. An export the app keeps that a test also names on purpose (a limit it counts with, a step it drives on its own, a reset hook) is tagged `@internal` in its doc comment with the reason, and that run leaves it out.

`src/testSetup.ts` runs before every `page` test file: it empties the module cache and re-arms auto-unmount, which the library only lets be armed once. `testUtils/sharedPage.ts`'s `resetSharedPage` empties what the last file left on the page: the body, styles, `<html>`'s `class`, `style` and `lang`, the title, both storages, and puts back the default `matchMedia` (a desk with a mouse, so key chips show) over any a file assigned. So each file starts in English and with the default key-hint state, as if it ran first (ticket 0608). It also fetches every language before the file runs: the app fetches only the one in use and each other one when it is chosen (ticket 0616), but a test mounts in any of them at once (`src/browserSetup.ts` does the same).

The setup also makes `Date.now` never read the same twice: Vue drops an event stamped no later than its listener was attached, so in a warm worker a click made in the same millisecond as the mount was lost whenever a capture listener saw it first.

## Cutting tests

Deleting a test that repeats a lower level (ticket 0599) loses nothing only when each of these holds; the Frame's pilot found a gap with each.

1. For every test deleted, name the test that still asserts its behavior, at the level that owns it. If there is none, keep the assertion there instead, not back in the App.
2. Every binding a template makes between a control and its handler (`@cancel="onCancelRemoveFrame"`) stays driven by one test: nothing else notices a control no test presses.
3. For a flow test that is trimmed, break each decision the flow makes by hand (which change it commits, whether it asks first), run the flow's tests, see one fail, and `git checkout` the file. An assertion that still passes is too weak: a Remove test that reads the last save passes when nothing was saved at all.

## The Worker's tests

`worker/test/*.test.ts` (ticket 71) are their own Vitest project (`worker`, in `vite.config.ts`), run in Node by the same `vitest run`. They start the real Worker in workerd through Miniflare 4, configured from the repo's own `wrangler.jsonc` for dev or production (`worker/test/harness.ts`), with local D1 and R2, and drive it black-box over HTTP and its `scheduled()` entry. Outbound calls (Turnstile, GraphQL Analytics, Healthchecks.io) are caught by the harness and answered by the test. `worker/test/fixtureWorker.ts` is the deployed Worker plus routes and a daily hook that exist only for the tests (the guards and blob stores have no caller until the feature tickets); never deployed. Until ticket 0078 gives them a caller, `knip --production` takes the guards, body reader, blob stores and the fixture Worker as entries of their own (`knip.jsonc`), so they are not reported as test-only; 0078 removes that.

- **Seam 1** (`api.test.ts`): requests in, responses out: health, an unknown path, kill switches, the Origin check, Turnstile with Cloudflare's dummy keys, size caps, the blob storage limit, rate limits through Miniflare's own Rate Limiting binding, both blob stores, no CORS, static assets.
- **Seam 2** (`watchdog.test.ts`): the Cron Trigger's run: success and `/fail` pings, dev's and production's levels, what each counts, a reader that fails, the daily hook.
- A change to `worker/migrations/` needs no extra test: the harness applies them before each Worker starts, so a broken one fails everything.
- Why Miniflare directly: `@cloudflare/vitest-pool-workers` supports Vitest 4 only, and Wrangler pins a Miniflare 5 alpha. Miniflare 4's workerd accepts compatibility dates up to 2026-08-06, which bounds `compatibility_date` in `wrangler.jsonc` until Miniflare is upgraded with it. Its last release, `4.20260730.0`, pins `undici` and `sharp` to versions with advisories, so `overrides` in `package.json` raises them to the patched releases Wrangler's own Miniflare uses. Drop the overrides when Miniflare goes to 5, and refuse Dependabot's move to a Miniflare 5 alpha. Miniflare's `dispatchFetch` sends a buffered body in chunks unless the test sets `Content-Length`, as a browser always does.

## The one layout

One layout is the only layout (ADR 0046, ticket 412), so no unit test mocks a layout flag and an App test drives the Tool pill and the strip's sheets. `src/testUtils/pill.ts` holds the helpers: `openPanel` (a strip button toggles, so it opens a sheet only when it is not the one showing), `pickTool` (a Tool pill tile), `selectAll` (Select, then Ctrl+A: there is no Select all button), `openColorPopover` and `pickColor` (through the colour popover), `toolState` (reads a Tool tile), `panelRead` (reads one element of the Project panel, then closes it), `chooseCustomColor`, `openNewProject`, `openSavedProjects`, `copySelection` (the Context bar's Copy), `rotate`, `deleteAll` and `chooseAppLanguage` (through the Menu panel). `createProjectViaForm` in `testUtils/seedProject.ts` raises the New Project panel itself.

Two things differ from a layout that keeps its controls on screen. Picking a Tool, a color or a Project closes the sheet it was picked in, so a test that reads the Palette again opens the sheet again. And a sheet that is open withholds the keyboard shortcuts and swallows the first press outside it, so a test that presses a key or the canvas closes the sheet first (`sheet-close`).

The visual check's helpers (`e2e/support/app.ts`, `e2e/visual/scenarios.ts`) and the perf specs (`e2e/perf/perf.spec.ts`, `e2e/perf/memory.spec.ts`) drive the same pill and sheets: opening a sheet before a control that sits in one (`openStripPanel`, for the strip's Menu and Project), picking a Tool with its pill tile (`selectTool`), opening the colour popover (`openColorPopover`), Copy by its chord (`copySelection`), and reading or stepping the zoom in the Canvas strip's cluster (`currentZoomPercent`, `setZoom`). The perf specs are not part of CI; run them by hand with `npm run perf`.

## The offline shell

`e2e/visual/offline.spec.ts` (part of `npm run visual`, ticket 69) is the one check that lets the service worker run (the others block it, in `playwright.config.ts`). It loads the production build once, waits for the worker to take control, then reloads with the network off and again with our hosting answering 503 (`e2e/support/hostProxy.ts` stands in front of the preview and can be taken down, slowed, or made to serve a new worker), and creates, edits, saves and reopens a Schema. It also checks the Homepage, installability, the persistent-storage request at the first save (after its note), "Update ready" and the splash in both themes. `vite.pwa.test.ts` builds the app and asserts every built file is in the worker's list and `index.html` is under 14 KB.

## Stored-data compatibility

`src/domain/compatibility.test.ts` opens every library and Project file format the app has ever written, from the literal fixtures in `src/domain/fixtures/`. The fixtures were written once and are never regenerated by the code under test. When the stored format changes, add a fixture for the new format and keep the old ones passing; never edit an existing fixture to make the test pass.

## Visual baselines

The visual check (`npm run visual`, README's Visual check) compares against the reference screenshots in `e2e/visual/__screenshots__/`. Update them only when the look is meant to change, never to make a failing run pass, and say so in the pull request.

- The Project-grid references (`look`, `overlays`, `interaction` specs, compared by `e2e/support/referenceCheck.ts`): `UPDATE_REFERENCES=1 npx playwright test <spec>`.
- The `toHaveScreenshot` references (`framing`, `canvasColor`, `rulers*` specs): `npm run visual:update -- <spec>` (rewrites only the images that differ).

A change that adds, removes or moves visible elements (a row in a panel, a control, a label) can change screenshots you didn't touch. Before the pull request, find the specs that open that screen (`grep -l <component or selector> e2e/visual/*.spec.ts`) and run them (`npx playwright test <specs>`) instead of learning it from CI's 6-minute shards. After a CI failure, `bash scripts/ci-failures.sh <pr>` lists the failed jobs and tests.

`Process from config.webServer was not able to start` means `npm run build` failed (the server builds first, `e2e/support/server.ts`) and Playwright hides why: run `npm run build` by hand to see it. Missing `esbuild`, `miniflare` or `wrangler` means `npm ci` is due.

The references are made on Linux, the platform CI runs. Commit the new images in the same pull request as the change that alters the look. When a run fails, read its `diff.png` first (see `CLAUDE.md`'s context hygiene).

## Text fit checks

Text that pokes out of its box, is cut off, or a Tooltip that is cut off, in any of the seven languages, is caught by tests that sit beside the code and run with the other tests (ticket 552). There is no whole-app run for it.

1. **Label widths** (`src/i18n/labelFit.test.ts`, plain Node): `textWidth` (`src/testUtils/textWidth.ts`) sets a string in the app's bundled fonts, reading the faces and unicode ranges from `src/styles/fonts.css`, and the test checks every key of a declared group against the room its place gives it, in all seven languages (so far the Homepage carousel's tab names and lines; each budget names the CSS its room comes from and the layout tier, and a failure names the key, language, tier, width needed and width allowed). Known overruns are in its `PENDING`, each deleted by the ticket that fixes it; one that fits again fails until removed. Chinese has no bundled font, so its glyphs count as one em and the result is an estimate. To cover a place, add a `Budget`. A language added to the app fails the type check until it is listed. The same file reports a group of translations that no mounted component reads and that no budget covers (a text with no declared room): mount the component that shows it, or list the group in `CHECKED_ELSEWHERE` with a reason.
2. **Component fit** (`*.browser.test.ts`, the `browser` project): `src/components/componentFit.browser.test.ts` (the fixed-size controls), `panelsFit.browser.test.ts` (the strip, the Menu, Project and Frame panels, lists, forms and dialogs of their own), `statesFit.browser.test.ts` (what a person reaches by acting: the colour popover, toasts, the save-failed notice, notes, panels expanded, the convert-image box, the empty library, the Selection bar), `src/components/shell/dialogsFit.browser.test.ts` (the shell's dialogs, opened through the dialog registry, with and without a Project) and `src/homepage/homepageFit.browser.test.ts` (the Homepage and every feature of its carousel) mount a component at the layout's width edges (`FIT_WIDTHS`; the Homepage at nine widths) in two languages (`FIT_LOCALES`, ticket 0606): English, the shortest text, and "longest", a test-only language whose every string is the widest of its seven translations, measured in the UI font (`src/testUtils/longestText.ts`). Text runs out where it is longest, and no real language is longest everywhere (Russian is for about a quarter of the strings), so one "longest" mount shows what any language would. It is shown in place of Russian, so its counts and numbers follow Russian's rules, and a carousel tab takes each language's shorter wording where it has one, as the tab does. What it cannot show is a layout fact other than width, such as a script's glyph height (`ProjectHead.browser.test.ts` tries every real language for that). One mount per language is resized through the widths (`problemsAcrossWidths`), so a failure names the width; the Homepage is mounted afresh at each width, as its carousel changes with it. A case's `act` (an expanded panel, an opened list) runs once, at the language's widest width, and the page is then narrowed with that state kept They fail on text that pokes out of its box or the screen, is cut by an ellipsis, or wraps in a control meant to be one line (`textFitInPage.ts`; user-typed Project names, carousel cards not yet scrolled to and the canvas's own backdrop and rulers are skipped). To add a component, add a case to a `CASES` list (`FitCase` in `src/testUtils/browserFit.ts`; its fourth item is what a person does to it first, such as expanding a panel). Text that does not fit yet goes in `src/testUtils/fitPending.ts` with the ticket that fixes it; a stale entry fails. `mountAt` sets the language on the shared preference (the app reads it from storage once), and `browserFit.browser.test.ts` guards that every mount really is in the language asked for, that "longest" holds the widest wordings, and that Russian is itself again after it.
3. **Tooltips**: every case of `describeFits` also opens each Tooltip it finds (`.app-tooltip`, no list of triggers) at 320 px, in English by hover, keyboard focus and a touch long press and in "longest" by hover alone, as whether a Tooltip opens does not depend on the language (`tooltipProblems`, `waysIn`), and checks the bubble against the screen, every ancestor that clips it and its own box (`measureOpenBubble`, `src/testUtils/hoverInPage.ts`). A failure names the trigger, its Tooltip text, the pixels cut and the way it was opened; known ones are in `fitPending.ts` under "<case> Tooltips". `src/components/ui/tooltips.browser.test.ts` tries the registry actions' Tooltips on their own (ticket 0607). They are all one component whose bubble is capped at a maximum width, so what can differ is only the shape of what it holds and how much text: the name alone, the name with its key chip, with a body line, off with the reason in place of the body, and placed above the trigger (the others open below it). Each shape is tried at the left and right edges in both languages, on the action whose Tooltip has the widest line in that language, measured in the UI font when the test runs, so the choice follows the copy; a shape no action has any more fails. Whether a Tooltip opens depends on neither the action nor the language, so hover, keyboard focus and a touch long press are each tried once, on one action, in English, and only the hover test waits for the hover delay (the others open by focus). Known limit: an action that is neither the widest of its shape nor in a mounted component is not opened on its own; as the bubble's width is capped and the screen's edges are what cut it, its text is not expected to fail where a wider one passes.
4. **Guards** (`src/testUtils/hoverSource.test.ts`, plain Node, they read the templates): no native `title` and no hand-made tooltip that is not listed in `src/testUtils/hoverExemptions.ts` (one way to make hover text); and every component whose template shows a translated text or makes a Tooltip is mounted by a browser fit test, or used in the template of one that is (`exercisedComponents`), or listed in `NOT_MOUNTED` with a reason. A new component with text and no case fails the guard.

Known limit: no check sees the assembled app. A bug that only shows in the combined layout (a panel clipping a Tooltip, two parts competing for room) is caught only where a component that holds the clipping ancestor is mounted. Tooltips in a state a case does not reach are not opened: give the case an action that reaches it.
