# bd-beads
beads drawing app

Copyright (C) 2026 czAAA (see [NOTICE](NOTICE)). Open source under the GNU Affero General Public License v3.0 or later (see [LICENSE](LICENSE)); AGPL because the app is served rather than distributed, so a modified copy hosted as a competing service must offer its users the modified source (AGPL §13); a permissive license or the GPL would not require that. Issues are welcome; outside contributions (pull requests) are not accepted yet. If it is useful to you, [Buy me a coffee](https://buymeacoffee.com/openbeads).

Hosted privately for now (tailnet only). The public deploy returns with the Cloudflare hosting ticket.

## Where the docs live

This repo is code only. Tickets, architecture decision records (the `ADR NNNN` numbers in the code and in these docs), specs and research live in a private repo, `czAAA/bd-beads-docs`. The code builds, lints and tests without it. To work with the docs, clone it next to this checkout and link it in:

```
git clone git@github.com:czAAA/bd-beads-docs.git ../bd-beads-docs
bash scripts/link-docs.sh
```

`link-docs.sh` creates gitignored symlinks (`.scratch`, `docs/adr`, `docs/research`, `docs/specs`, `docs/operations.md`, `reports`, `research_notes`), so tickets, ADRs and the operations runbook keep their paths. It is safe to run again, and refuses to replace a real folder. To move a machine from the old single-repo checkout, run `bash scripts/migrate.sh`.

## Works offline

bd-beads is local-first (ADR 0001): every Project lives in the browser, so the app opens and works with no internet, and when our hosting is down, from the copy the service worker cached (ticket 69). Only what needs the backend (View links, sync, accounts; ADR 0014) stops, and says so with a message (ticket 381). The first visit needs a network once. Limits that cost money are enforced on the server, never in this code (ADR 0044).

To try it: open the built app (`npm run build && npm run preview`), load it once, switch the browser to offline in DevTools (Network), and reload. Chrome's Application tab shows the worker (`sw.js`), its cache and the manifest. The first visit needs the network once; the offline copy then downloads silently behind the app.

The app can be installed from the browser (Chrome's install button, "Add to Home Screen" in iOS Safari) and then opens like any other app. A new version downloads in the background and shows "Update ready, Reload" in the open tab; it also arrives by itself the next time the app is opened. How it works and why it is hand-written: ADR 0045. The worker is only built and registered in production builds, so `npm run dev` never caches anything.


## Checks

| Command | What it checks |
| --- | --- |
| `npm test` | Unit and component tests (Vitest, jsdom), and the backend Worker's tests (`worker/test/`, in Node against workerd; `docs/testing.md`). Includes the stored-data compatibility test, `src/domain/compatibility.test.ts`, which opens libraries and Project files in every format the app has written (version 1 and 2 libraries, single-Project and whole-library files, a Project past the old 10,000-cell cap) from the literal fixtures in `src/domain/fixtures/` |
| `npm run typecheck` | Type-checks the app, the build config, the browser checks and the Worker |
| `npm run lint` | ESLint |
| `npm run visual` | The visual check (below). Run on every pull request by CI (below) |
| `npm run visual:update` | Rewrites the Convert image framing screenshots, the only ones the Playwright runner itself owns; the others are read from `e2e/visual/__screenshots__` as they are, and change only when the look is meant to (delete and regenerate them deliberately) |
| `npm run perf` | The performance check (below). By hand, never in CI |

### Visual check

Renders fixture Projects in a real browser (Playwright, Chromium) and compares the drawn grid with the reference screenshots in `e2e/visual/__screenshots__`: loom, peyote and brick stitch; Row progress in both directions; a Selection; a paste preview; Mirror axes and the "Mirror current" dimming; hover previews; and the Convert image wizard's preview and layouts. Each Project scenario is shot at 25%, 100% and 300% zoom, upright and rotated. Only the grid is compared, not the rulers or other text, since fonts differ between machines and the beads do not.

Those references were made from the one-element-per-bead grid the renderer replaced (ticket 103), and are what the renderer is held to ("visually indistinguishable", ADR 0018). A canvas never lands on exactly the same pixels as the DOM did, so the comparison is two checks (`e2e/support/referenceCheck.ts`): a look check (both images reduced to the average color of blocks a fraction of a bead wide, at most a per-Technique share of blocks may differ) and a content check (every bead's centre is its color, finished rows' greys included). `e2e/visual/look.spec.ts` runs them on the app for every Technique, plain and with Row progress in both directions, at every zoom, upright and rotated; `overlays.spec.ts` for the Selection, paste preview, Mirror axes and dimming; `interaction.spec.ts` for the hover preview and for the pointer tools (paint, erase, Fill, Row progress lock, Mirror, Undo, Space-drag pan, a touch stroke); `convertImage.spec.ts` for the Convert image wizard's preview By size and its two layouts; `large-projects.spec.ts` for 70 × 250 and 250 × 250 Projects end to end. The check tests itself: `look.spec.ts` renders Projects with a bead recolored or missing, and a Row progress marker the reference does not have, and expects the comparison to fail.

The first run needs the browser: `npx playwright install chromium`. The references are made and checked on Linux, the platform CI runs; on another OS, small rendering differences can fail the check locally. To look at a failure, open `playwright-report/index.html` (`npx playwright show-report`). CI runs it on every pull request (see CI).

### CI

CI is the gate (`docs/testing.md`, CI). Every pull request to `main` runs typecheck and lint, the unit tests and the visual check on GitHub, and branch protection requires the aggregate checks "Typecheck and lint", "Unit tests passed" and "Visual check passed". A PR that changes only Markdown skips them. A failed visual run uploads its report as an artifact. While working, run only the tests related to your change (`npx vitest related --run <files>`); a full unit run peaks near 1.5 GB of RAM, so leave the full suite to CI.

### Performance check

`npm run perf` builds the app and drives it at a chosen CPU slowdown, printing frames per second and main-thread time for hovering, painting a stroke, scrolling, a zoom step, opening a Project and dragging the Convert image framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop, "the floor") and at 6×. Options are environment variables: `PERF_SLOWDOWNS=4`, `PERF_SIZES=70x250`, `PERF_ONLY=hover,paint`, `PERF_TECHNIQUES=loom,peyote,brick` for the framing drag (see the top of `e2e/perf/perf.spec.ts`). Run it on an otherwise idle machine; timings vary from run to run, so compare numbers taken the same way. Targets: 60 fps for hover, paint and pan at 250×250 on an iPad Air 13″; at least 30 fps at the floor at 70×250 and 250×250; opening a Project in about 200 ms; a smooth framing drag.

The same run also measures the big Canvases (`e2e/perf/canvases.spec.ts`, ticket 0673): 50 scattered 40×40 Pieces, one 300×300 Piece unnamed and named, a 300×300 Frame over about 80,000 Canvas beads, a library of ten 300×300 Projects, a 300×300 Piece-shaped Selection and a 300×300 copied block, each in loom and peyote. It times a two-second Paint stroke, panning at fit and at 100%, one Fill, Paste and Undo, hovering the Paste and dragging across the shaped Selection, and counts the long animation frames (over 50 ms, with the scripts that took the time; Chromium only). Each line is printed against its budget: no long frame in a stroke, under 8 ms of script a pointer move, under 100 ms an edit. Options: `PERF_TECHNIQUES` (default `loom,peyote` here), `PERF_FIXTURES='piece,frame over canvas'`, `PERF_ONLY=stroke,edits`; `npm run perf -- canvases` runs it alone, and `PERF_ONLY` takes either spec's scenario names. Set `E2E_PORT` when another worktree's preview is running. The first run's output is the baseline later perf work compares against, kept in the docs repo next to the report ("Canvas performance for large patterns").

Fill reach (`e2e/perf/fillReach.spec.ts`, ticket 0715) times a Fill tool press flooding a Piece as big as the Fill cap, with its redraw, save and Piece recount, and a press on empty space a screen away from the scattered Pieces at the Zoom floor, which must be refused and leave the saved beads as they were; each against the 100 ms an edit has. Options: `PERF_SLOWDOWNS` (default `4` here), `PERF_TECHNIQUES`, and `PERF_FILL_SIDE` to time a Piece of another side when looking for where the cap fits; `npm run perf -- fillReach` runs it alone.

A Project that won't open (`e2e/perf/hugeProject.spec.ts`, ticket 0716) stores a synthetic Project of one solid layer of millions of beads (never the maintainer's own library) and times opening the Projects library subpanel with it in the library, its open from the pick (Open anyway, over the size gate) to the first drawn frame, and a stroke, a Fill of an enclosed patch and Undo on it, against one second for the open and 100 ms a click. Options: `PERF_SLOWDOWNS` (default `4`), `PERF_HUGE_MILLIONS` (default `9`; a list such as `1,2,9,12` shows where the open passes a second); `npm run perf -- hugeProject` runs it alone.
