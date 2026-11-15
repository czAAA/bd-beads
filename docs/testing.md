# Testing

How tests are written in this repo. The commands are in the README's Checks; the review rules are in [`CODING_STANDARDS.md`](../CODING_STANDARDS.md).

This page holds the rules every test follows. The reference pages in `docs/testing/` are read only when the work is in their area:

| Page | Holds |
|---|---|
| [`testing/helpers.md`](testing/helpers.md) | Shared test helpers: every file in `src/testUtils/`, the `page` setup, and the helpers that drive the Tool pill and its sheets |
| [`testing/text-fit.md`](testing/text-fit.md) | Text fit checks: label widths, component fit, Tooltips, the guards, and their known limit |
| [`testing/worker.md`](testing/worker.md) | The Worker's tests: the Miniflare harness and its two seams |
| [`testing/ci.md`](testing/ci.md) | CI: what a pull request runs, the required checks, and why a pull request that changes only Markdown needs an admin merge |
| [`testing/browser-checks.md`](testing/browser-checks.md) | The offline shell's check, and the manual check of popups in real Safari |

## Running them

- While working, run only the tests related to your change: `npm run test:related -- <changed files>`. It runs `vitest related` with the `agent` reporter and `--silent=passed-only`, so a green run prints a few lines, and it leaves out the `App.*.test.ts` files: the App imports everything, so almost any UI change would pull in all 19 of them (about 4 min of CPU on the Pi). The full unit suite peaks near 2 GB of RAM (summed over its worker processes, the largest about 0.8 GB; measured after tickets 420 and 422), so on a slow machine its one run is CI's, on every pull request, even where a skill says to run it at the end (`CLAUDE.md`, Context hygiene). `npm run test:full` makes that machine-dependent: before a pull request opens it runs the whole suite (`agent` reporter, `--silent=passed-only`) when the machine has at least 8 cores and 8 GB (available on Linux, total on macOS) and prints a skip line otherwise. `BD_FULL_TESTS=1` forces the run, `BD_FULL_TESTS=0` forces the skip. CI stays the gate either way.
- Add an App file to the command (`npm run test:related -- src/ProgressBar.vue src/App.canvas.test.ts`) only when your change touches the App's wiring: a shell, a keyboard shortcut, a flow that spans components. It is then run on its own, in the same quiet mode.
- `npm run typecheck` and `npm run lint` are cheap; run them before pushing.

## Where a test goes

- A unit or component test sits beside its file as `<name>.test.ts`.
- Which Vitest project a test runs in (ticket 420) follows from where it sits and what it is called:
  - `page` (jsdom, one page shared by every file a worker runs): anything under `src/components/` or `src/homepage/`, every `src/App*.test.ts`, and any other test that needs a page or its storage (`document`, `window`, `localStorage`, `sessionStorage`, a canvas) named `<name>.dom.test.ts`.
  - `unit` (plain Node, no per-file isolation): everything else. A new domain, rendering or service test needs no setup. If it fails there on `document`, `window` or `localStorage` being undefined, rename it `.dom.test.ts`.
  - `browser` (real Chromium through Vitest browser mode, ticket 552): `<name>.browser.test.ts`, for layout facts jsdom cannot know (text that fits, a Tooltip kept on screen). It mounts one component at a width and language with `mountAt` (`src/testUtils/browserFit.ts`), which loads the app's own styles and fonts, and measures whether its text fits and its Tooltips stay on screen. It runs where Chromium is installed (`npx playwright install chromium`) and skips itself where it is not (the Pi); `BD_BROWSER_TESTS=1` turns a missing Chromium into an error, `=0` skips it. A `.browser.test.ts` is never run by `unit` or `page`. A `*.touch.browser.test.ts` runs in `browser-touch` instead, a page of its own with Playwright's `hasTouch`, so `(pointer: coarse)` matches as on an iPad (ticket 0962): switching CDP touch emulation off again left the shared page with no pointer at all on CI, and the next files lost their key chips.
  - In both, files share one module cache per worker within a project, so keep module state and `vi.mock` inside the file and undo what a test installs on a global (`vi.unstubAllGlobals()`, `vi.restoreAllMocks()`).
- Why sharing: setting up jsdom per file was most of the suite's time. Measured on the Pi with 2 workers (ticket 420), the App files take 217 s wall and 374 s CPU sharing one page per worker and 378 s and 567 s isolated, so they share too.
- Test at the highest seam that already exists for the behavior, through its public interface, and don't add a seam only to reach an internal. Mount the whole App only when the App's wiring is the subject; otherwise test the domain function, the flow composable or the component on its own (ticket 253 moved logic tests down out of the App tests).
- A shell part's wiring (a panel control reaching its flow, the dialog it asks through) is tested by mounting that part under the real wiring with `mountShellParts` (`src/testUtils/shellHost.ts`, ticket 0618), not the App: `AppPanels.test.ts`, `AppDialogs.test.ts`. An App test is left for wiring that spans parts, such as a strip button opening its panel or the canvas reaching a flow.
- An App test proves the wiring (control → flow → storage or screen) with one happy path. Edge cases and every variant (each key, each guard, each label, each tool) live at the lowest level that has them: the shortcut table, the component, the flow. Use one language unless the language switch is the subject; the `Translations` type already makes every language complete. A mount costs 250–330 ms on the Pi, so every extra App mount is paid by every CI run (ticket 421).
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

What each helper file does is listed in [`testing/helpers.md`](testing/helpers.md); look there before writing a new one.

App code holds only what the app uses (ticket 0609): `npm run knip`'s second run, `knip --production`, leaves the tests and these helpers out and fails on a file or export only a test reaches. A fixture builder belongs here, not in `src/`. An export the app keeps that a test also names on purpose (a limit it counts with, a step it drives on its own, a reset hook) is tagged `@internal` in its doc comment with the reason, and that run leaves it out.

## Cutting tests

Deleting a test that repeats a lower level (ticket 0599) loses nothing only when each of these holds; the Frame's pilot found a gap with each.

1. For every test deleted, name the test that still asserts its behavior, at the level that owns it. If there is none, keep the assertion there instead, not back in the App.
2. Every binding a template makes between a control and its handler (`@cancel="onCancelRemoveFrame"`) stays driven by one test: nothing else notices a control no test presses.
3. For a flow test that is trimmed, break each decision the flow makes by hand (which change it commits, whether it asks first), run the flow's tests, see one fail, and `git checkout` the file. An assertion that still passes is too weak: a Remove test that reads the last save passes when nothing was saved at all.

## The one layout

One layout is the only layout (ADR 0046, ticket 412), so no unit test mocks a layout flag and an App test drives the Tool pill and the strip's sheets. The helpers that drive them are in `src/testUtils/pill.ts` ([`testing/helpers.md`](testing/helpers.md), The one layout's helpers).

Two things differ from a layout that keeps its controls on screen. Picking a Tool, a color or a Project closes the sheet it was picked in, so a test that reads the Palette again opens the sheet again. And a sheet that is open withholds the keyboard shortcuts and swallows the first press outside it, so a test that presses a key or the canvas closes the sheet first (`sheet-close`).

## Stored-data compatibility

`src/domain/compatibility.test.ts` opens every library and Project file format the app has ever written, from the literal fixtures in `src/domain/fixtures/`. The fixtures were written once and are never regenerated by the code under test. When the stored format changes, add a fixture for the new format and keep the old ones passing; never edit an existing fixture to make the test pass.

A Custom frame's beads are saved by layout position (ADR 0078), so each Frame shape has a golden layout in `src/domain/fixtures/layouts/<shape>.json`, checked by `frameShape.test.ts` (ticket 0632): a shape without one fails, and so does a builder that moves a position. A new shape writes its file once; a builder change that moves positions is a new layout version with a reader for the old one, never an edited golden file.

## Visual baselines

The visual check (`npm run visual`, README's Visual check) compares against the reference screenshots in `e2e/visual/__screenshots__/`. Update them only when the look is meant to change, never to make a failing run pass, and say so in the pull request.

- The Project-grid references (`look`, `overlays`, `interaction` specs, compared by `e2e/support/referenceCheck.ts`): `UPDATE_REFERENCES=1 npx playwright test <spec>`.
- The `toHaveScreenshot` references (`convertImage`, `canvasColor`, `roundBeads`, `rulers*` specs): `npm run visual:update -- <spec>` (rewrites only the images that differ).

A change that adds, removes or moves visible elements (a row in a panel, a control, a label) can change screenshots you didn't touch. Before the pull request, find the specs that open that screen (`grep -l <component or selector> e2e/visual/*.spec.ts`) and run them (`npx playwright test <specs>`) instead of learning it from CI's 6-minute shards. After a CI failure, `bash scripts/ci-failures.sh <pr>` lists the failed jobs and tests.

`Process from config.webServer was not able to start` means `npm run build` failed (the server builds first, `e2e/support/server.ts`) and Playwright hides why: run `npm run build` by hand to see it. Missing `esbuild`, `miniflare` or `wrangler` means `npm ci` is due.

The references are made on Linux, the platform CI runs. Commit the new images in the same pull request as the change that alters the look. When a run fails, read its `diff.png` first (see `CLAUDE.md`'s context hygiene).
