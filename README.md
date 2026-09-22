# bd-beads
beads drawing app

Live at: https://czAAA.github.io/bd-beads/

## Deploy

Hosted on GitHub Pages — see [ADR 0003](docs/adr/0003-github-pages-hosting.md) for why and what that requires from the build. Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the app and publishes it to Pages; no manual deploy step is needed.

One-time repo setup: under Settings → Pages, set Source to "GitHub Actions".

## Checks

| Command | What it checks |
| --- | --- |
| `npm test` | Unit and component tests (Vitest, jsdom). Includes the stored-data compatibility test, `src/domain/compatibility.test.ts`, which opens libraries and Pattern files in every format the app has written (version 1 and 2 libraries, single-Pattern and whole-library files, a Pattern past the old 10,000-cell cap) from the literal fixtures in `src/domain/fixtures/` |
| `npm run typecheck` | Type-checks the app, the build config and the browser checks |
| `npm run lint` | ESLint |
| `npm run visual` | The visual check (below). Runs in CI |
| `npm run visual:update` | Rewrites the Convert image framing screenshots, the only ones the Playwright runner itself owns; the others are read from `e2e/visual/__screenshots__` as they are, and change only when the look is meant to (delete and regenerate them deliberately) |
| `npm run perf` | The performance check (below). By hand, never in CI |

### Visual check

Renders fixture Patterns in a real browser (Playwright, Chromium) and compares the drawn grid with the reference screenshots in `e2e/visual/__screenshots__`: loom, peyote and brick stitch; Row progress in both directions; a Selection; a paste preview; Mirror axes and the "Mirror current" dimming; hover previews; and the Convert image framing preview. Each Pattern scenario is shot at 25%, 100% and 300% zoom, upright and rotated. Only the grid is compared, not the rulers or other text, since fonts differ between machines and the beads do not.

Those references were made from the one-element-per-bead grid the renderer replaced (ticket 103), and are what the renderer is held to ("visually indistinguishable", ADR 0018). A canvas never lands on exactly the same pixels as the DOM did, so the comparison is two checks (`e2e/support/referenceCheck.ts`): a look check (both images reduced to the average color of blocks a fraction of a bead wide, at most a per-Technique share of blocks may differ) and a content check (every bead's centre is its color, finished rows' greys included). `e2e/visual/look.spec.ts` runs them on the app for every Technique, plain and with Row progress in both directions, at every zoom, upright and rotated; `overlays.spec.ts` for the Selection, paste preview, Mirror axes and dimming; `interaction.spec.ts` for the hover preview and for the pointer tools (paint, erase, Fill, Row progress lock, Mirror, Undo, Space-drag pan, a touch stroke); `framing.spec.ts` for the Convert image framing preview; `large-patterns.spec.ts` for 70 × 250 and 250 × 250 Patterns end to end. The check tests itself: `look.spec.ts` renders Patterns with a bead recolored or missing, and a Row progress marker the reference does not have, and expects the comparison to fail.

The first run needs the browser: `npx playwright install chromium`. The references are made and checked on Linux, the platform CI runs; on another OS, small rendering differences can fail the check locally. To look at a failure, open `playwright-report/index.html` (`npx playwright show-report`).

### Performance check

`npm run perf` builds the app and drives it at a chosen CPU slowdown, printing frames per second and main-thread time for hovering, painting a stroke, scrolling, a zoom step, opening a Pattern and dragging the Convert image framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop, "the floor") and at 6×. Options are environment variables: `PERF_SLOWDOWNS=4`, `PERF_SIZES=70x250`, `PERF_ONLY=hover,paint`, `PERF_TECHNIQUES=loom,peyote,brick` for the framing drag (see the top of `e2e/perf/perf.spec.ts`). Run it on an otherwise idle machine; timings vary from run to run, so compare numbers taken the same way. Targets: 60 fps for hover, paint and pan at 250×250 on an iPad Air 13″; at least 30 fps at the floor at 70×250 and 250×250; opening a Pattern in about 200 ms; a smooth framing drag.
