# Testing

How tests are written in this repo. The commands are in the README's Checks; the review rules are in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md).

## Running them

- While working, run only the tests related to your change: `npm run test:related -- <changed files>`. It runs `vitest related` with the `agent` reporter and `--silent=passed-only`, so a green run prints a few lines, and it leaves out the `App.*.test.ts` files: the App imports everything, so almost any UI change would pull in all 21 of them (about 4 min of CPU on the Pi). The full unit suite peaks near 2 GB of RAM (summed over its worker processes, the largest about 0.8 GB; measured after tickets 420 and 422), so on a slow machine its one run is CI's, on every pull request, even where a skill says to run it at the end (`CLAUDE.md`, Context hygiene). `npm run test:full` makes that machine-dependent: before a pull request opens it runs the whole suite (`agent` reporter, `--silent=passed-only`) when the machine has at least 8 cores and 8 GB (available on Linux, total on macOS) and prints a skip line otherwise. `BD_FULL_TESTS=1` forces the run, `BD_FULL_TESTS=0` forces the skip. CI stays the gate either way.
- Add an App file to the command (`npm run test:related -- src/ProgressBar.vue src/App.canvas.test.ts`) only when your change touches the App's wiring: a shell, a keyboard shortcut, a flow that spans components. It is then run on its own, in the same quiet mode.
- `npm run typecheck` and `npm run lint` are cheap; run them before pushing.

## CI

CI (`.github/workflows/ci.yml`) is the gate: every pull request to `main` runs typecheck, lint and knip, the unit tests (Vitest shards) and the visual check (Playwright shards over one shared build). GitHub is the proof a change passed; nothing rests on a habit on one machine.

- Each suite ends in one job with a stable name, and branch protection requires those three: "Typecheck and lint", "Unit tests passed", "Visual check passed". The shard counts can change in `ci.yml` without touching branch protection.
- A pull request that changes only Markdown is skipped by `paths-ignore`, so its required checks never start and it waits forever: merge it with an admin override.
- The workflow uses `pull_request` (never `pull_request_target`), a read-only token and no secrets, and pins every action to a commit SHA.
- A failed visual shard uploads its `test-results`, and the shards' reports are merged into one HTML report artifact.
- The performance check (`npm run perf`, README) is run by hand, never in CI: its timings depend on an idle machine.

## Where a test goes

- A unit or component test sits beside its file as `<name>.test.ts`.
- Which Vitest project a test runs in (ticket 420) follows from where it sits and what it is called:
  - `page` (jsdom, one page shared by every file a worker runs): anything under `src/components/` or `src/overview/`, every `src/App*.test.ts`, and any other test that needs a page or its storage (`document`, `window`, `localStorage`, `sessionStorage`, a canvas) named `<name>.dom.test.ts`.
  - `unit` (plain Node, no per-file isolation): everything else. A new domain, rendering or service test needs no setup. If it fails there on `document`, `window` or `localStorage` being undefined, rename it `.dom.test.ts`.
  - In both, files share one module cache per worker within a project, so keep module state and `vi.mock` inside the file and undo what a test installs on a global (`vi.unstubAllGlobals()`, `vi.restoreAllMocks()`).
- Why sharing: setting up jsdom per file was most of the suite's time. Measured on the Pi with 2 workers (ticket 420), the App files take 217 s wall and 374 s CPU sharing one page per worker and 378 s and 567 s isolated, so they share too.
- Test at the highest seam that already exists for the behavior, through its public interface, and don't add a seam only to reach an internal. Mount the whole App only when the App's wiring is the subject; otherwise test the domain function, the flow composable or the component on its own (ticket 253 moved logic tests down out of the App tests).
- An App test proves the wiring (control → flow → storage or screen) with one happy path. Edge cases and every variant (each key, each guard, each label, each tool) live at the lowest level that has them: the shortcut table, the component, the flow. Use one language unless the language switch is the subject; the `Translations` type already makes both languages complete. A mount costs 250–330 ms on the Pi, so every extra App mount is paid by every CI run (ticket 421).
- App-level tests are split by area: `src/App.<area>.test.ts`. Add to the file for the area, or start a new one; don't grow `App.test.ts`.

## Prior art to copy

| Kind | Copy | Notes |
|---|---|---|
| Pure domain logic | `src/domain/changeFrame.test.ts` | Plain inputs and outputs, no mounting |
| A flow composable that edits the Project | `src/composables/tools/useRotateSelectionFlow.test.ts` | Drives a real Edit and Undo through `editHarness` |
| A component on its own | `src/components/ui/MenuButton.test.ts`, `src/components/canvas/ProgressBar.test.ts` | `mount` with props, assert on what the person sees |
| The control registry and its keys | `src/composables/shell/controlRegistry.test.ts` | A duplicate key fails here |
| Drawing | `src/rendering/overlayRenderer.test.ts` | `recordingContext` writes down every draw call |
| The App's wiring | `src/App.selection.test.ts` | Starts from a saved Project with `mountWithProject` |

## Shared test helpers (`src/testUtils/`)

- `chooseLanguage.ts`: `chooseLanguage(wrapper, 'ru')` opens the language switcher's list and picks that language (ticket 368).
- `seedProject.ts`: `seedProject` saves a Project, `mountWithProject` mounts the App on it (no form driving), `createProjectViaForm` for the one test that is about the form.
- `editHarness.ts`: a real Edit and Undo history over one in-memory Project, for flow tests (ADR 0036).
- `beads.ts`: press, hover and read beads on a mounted surface (`pressBead`, `hoverBead`, `beadColor`, `beadColors`, `rowProgressView`, `rulerNumbers`, …).
- `fakeCanvas.ts`, `recordingContext.ts`: jsdom has no canvas; these stand in for it.
- `fakeMatchMedia.ts`, `fakeResizeObserver.ts`, `surfaceLayout.ts`: media queries, element sizes and layout a test controls.
- `storageWrites.ts`: count localStorage writes, or make one fail.
- `rotated.ts`: a ready-made rotated Project.

`src/testSetup.ts` runs before every `page` test file: it empties the module cache and the page the last file left (body, styles, storage), and re-arms auto-unmount, which the library only lets be armed once.

## The Worker's tests

`worker/test/*.test.ts` (ticket 71) are their own Vitest project (`worker`, in `vite.config.ts`), run in Node by the same `vitest run`. They start the real Worker in workerd through Miniflare 4, configured from the repo's own `wrangler.jsonc` for dev or production (`worker/test/harness.ts`), with local D1 and R2, and drive it black-box over HTTP and its `scheduled()` entry. Outbound calls (Turnstile, GraphQL Analytics, Healthchecks.io) are caught by the harness and answered by the test. `worker/test/fixtureWorker.ts` is the deployed Worker plus routes and a daily hook that exist only for the tests (the guards and blob stores have no caller until the feature tickets); never deployed.

- **Seam 1** (`api.test.ts`): requests in, responses out: health, an unknown path, kill switches, the Origin check, Turnstile with Cloudflare's dummy keys, size caps, the blob storage limit, rate limits through Miniflare's own Rate Limiting binding, both blob stores, no CORS, static assets.
- **Seam 2** (`watchdog.test.ts`): the Cron Trigger's run: success and `/fail` pings, dev's and production's levels, what each counts, a reader that fails, the daily hook.
- A change to `worker/migrations/` needs no extra test: the harness applies them before each Worker starts, so a broken one fails everything.
- Why Miniflare directly: `@cloudflare/vitest-pool-workers` supports Vitest 4 only, and Wrangler pins a Miniflare 5 alpha. Miniflare 4's workerd accepts compatibility dates up to 2026-08-06, which bounds `compatibility_date` in `wrangler.jsonc` until Miniflare is upgraded with it. Its last release, `4.20260730.0`, pins `undici` and `sharp` to versions with advisories, so `overrides` in `package.json` raises them to the patched releases Wrangler's own Miniflare uses. Drop the overrides when Miniflare goes to 5, and refuse Dependabot's move to a Miniflare 5 alpha. Miniflare's `dispatchFetch` sends a buffered body in chunks unless the test sets `Content-Length`, as a browser always does.

## The one layout

One layout is the only layout (ADR 0046, ticket 412), so no unit test mocks a layout flag and an App test drives the Tool pill and the strip's sheets. `src/testUtils/pill.ts` holds the helpers: `openPanel` (a strip button toggles, so it opens a sheet only when it is not the one showing), `pickTool` (a Tool pill tile), `selectAll` (Select, then Ctrl+A: there is no Select all button), `openColorPopover` and `pickColor` (through the colour popover), `toolState` (reads a Tool tile), `panelRead` (reads one element of the Project panel, then closes it), `chooseCustomColor`, `openNewProject`, `openSavedProjects`, `copySelection` (the Context bar's Copy), `rotate`, `deleteAll` and `chooseAppLanguage` (through the Menu panel). `createProjectViaForm` in `testUtils/seedProject.ts` raises the New Project panel itself.

Two things differ from a layout that keeps its controls on screen. Picking a Tool, a color or a Project closes the sheet it was picked in, so a test that reads the Palette again opens the sheet again. And a sheet that is open withholds the keyboard shortcuts and swallows the first press outside it, so a test that presses a key or the canvas closes the sheet first (`sheet-close`).

The visual check's helpers (`e2e/support/app.ts`, `e2e/visual/scenarios.ts`) and the perf specs (`e2e/perf/perf.spec.ts`, `e2e/perf/memory.spec.ts`) drive the same pill and sheets: opening a sheet before a control that sits in one (`openStripPanel`, for the strip's Menu and Project), picking a Tool with its pill tile (`selectTool`), opening the colour popover (`openColorPopover`), Copy by its chord (`copySelection`), and reading or stepping the zoom in the Canvas strip's cluster (`currentZoomPercent`, `setZoom`). The perf specs are not part of CI; run them by hand with `npm run perf`.

## The offline shell

`e2e/visual/offline.spec.ts` (part of `npm run visual`, ticket 69) is the one check that lets the service worker run (the others block it, in `playwright.config.ts`). It loads the production build once, waits for the worker to take control, then reloads with the network off and again with our hosting answering 503 (`e2e/support/hostProxy.ts` stands in front of the preview and can be taken down, slowed, or made to serve a new worker), and creates, edits, saves and reopens a Schema. It also checks the Overview, installability, the persistent-storage request at the first save (after its note), "Update ready" and the splash in both themes. `vite.pwa.test.ts` builds the app and asserts every built file is in the worker's list and `index.html` is under 14 KB.

## Stored-data compatibility

`src/domain/compatibility.test.ts` opens every library and Project file format the app has ever written, from the literal fixtures in `src/domain/fixtures/`. The fixtures were written once and are never regenerated by the code under test. When the stored format changes, add a fixture for the new format and keep the old ones passing; never edit an existing fixture to make the test pass.

## Visual baselines

The visual check (`npm run visual`, README's Visual check) compares against the reference screenshots in `e2e/visual/__screenshots__/`. Update them only when the look is meant to change, never to make a failing run pass, and say so in the pull request.

- The Project-grid references (`look`, `overlays`, `interaction` specs, compared by `e2e/support/referenceCheck.ts`): `UPDATE_REFERENCES=1 npx playwright test <spec>`.
- The `toHaveScreenshot` references (`framing`, `canvasColor`, `rulers*` specs): `npm run visual:update -- <spec>` (rewrites only the images that differ).

A change that adds, removes or moves visible elements (a row in a panel, a control, a label) can change screenshots you didn't touch. Before the pull request, find the specs that open that screen (`grep -l <component or selector> e2e/visual/*.spec.ts`) and run them (`npx playwright test <specs>`) instead of learning it from CI's 6-minute shards. After a CI failure, `bash scripts/ci-failures.sh <pr>` lists the failed jobs and tests.

`Process from config.webServer was not able to start` means `npm run build` failed (the server builds first, `e2e/support/server.ts`) and Playwright hides why: run `npm run build` by hand to see it. Missing `esbuild`, `miniflare` or `wrangler` means `npm ci` is due.

The references are made on Linux, the platform CI runs. Commit the new images in the same pull request as the change that alters the look. When a run fails, read its `diff.png` first (see `CLAUDE.md`'s context hygiene).

## Text fit check

`e2e/visual/textFit.spec.ts` (part of `npm run visual`, ticket 229) opens the app in every language at every supported width, visits each screen, menu, sheet, dialog and popover, and measures — no reference screenshots — whether any text pokes out of its box, the screen or a clipping ancestor, is cut off by an ellipsis, or wraps in a control meant to be one line (`e2e/support/textFit.ts`; user-typed Project names, carousel cards not yet scrolled to and the canvas's own backdrop and rulers are skipped). A failure names the screen, element, text, overflow in pixels, language and width.

Places known to overflow are listed in `e2e/support/textFitPending.ts`, each deleted by the ticket that fixes it; an entry that stops overflowing fails the check until it is removed. To add a screen, add a `Screen` to `SCREENS` in the spec (its `visit` drives the app by its own controls and calls `measure()`, or returns false where the state can't be reached); to add a language, list it in `LOCALES` (the type check reminds you). `TEXTFIT_DEBUG=1` prints every misfit and skipped screen.

**It also covers hover text** (ticket 264): on every screen it visits it finds every Tooltip trigger from the page (`.app-tooltip`, no list of triggers), opens each by mouse hover, keyboard focus and a touch long press (a disabled one also by a click), and measures the bubble against the screen, every ancestor that clips it and its own box (`e2e/support/hoverText.ts`); a failure names the screen, trigger, Tooltip text, pixels cut, language and width. Cut-off Tooltips known today are in `e2e/support/hoverPending.ts` (deleted by ticket 265, an entry that stops failing fails the check).

Three guards keep it exhaustive:

1. *Discovery*, above.
2. *Reachability*: every component whose template makes a Tooltip (`<AppTooltip>`, `IconButton`; the bubble's `data-owner` says which) or an info popover must be seen open somewhere in the run, checked once by the Playwright global teardown after all language-and-width tests (`e2e/support/hoverReach.ts`), so a Tooltip in a state no screen visits fails naming the component: add a `Screen` that reaches it, or list it in `UNREACHED` with a reason (`e2e/support/hoverExemptions.ts`).
3. *One way to make hover text*: `e2e/visual/hoverSource.spec.ts` reads the templates and fails on a native `title` or a hand-made tooltip that is not listed (`NATIVE_TITLES`, each "native, cannot be clipped" until moved onto the Tooltip; `INFO_POPOVERS`, which text fit measures once).

A partial run (one language or width) skips guard 2.
