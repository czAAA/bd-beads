# bd-beads
beads drawing app

Proprietary software, all rights reserved (see [LICENSE](LICENSE)). This is a private repository, not open source, and is not accepting outside contributions.

Hosted privately (tailnet only): https://tailnet-host.example:8444/bd-beads/

## Deploy

The build is served from the owner's Flint 2 router, reachable only over Tailscale; see [ADR 0022](docs/adr/0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md) for why and what a new host would need. Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it tests and builds the app, joins the tailnet as `tag:ci` and rsyncs `dist/` to the router. No manual deploy step is needed. A run can also be started by hand from the Actions tab ("Run workflow").

The host and path come from GitHub Actions settings, not the workflow. Variables: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` (with a trailing slash), `DEPLOY_BASE` (the URL path the app is served from, default `/bd-beads/`). Secrets: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. Don't set `DEPLOY_BASE` when running `npm run visual` locally; the browser checks expect the default.

## Checks

| Command | What it checks |
| --- | --- |
| `npm test` | Unit and component tests (Vitest, jsdom). Includes the stored-data compatibility test, `src/domain/compatibility.test.ts`, which opens libraries and Project files in every format the app has written (version 1 and 2 libraries, single-Project and whole-library files, a Project past the old 10,000-cell cap) from the literal fixtures in `src/domain/fixtures/` |
| `npm run typecheck` | Type-checks the app, the build config and the browser checks |
| `npm run lint` | ESLint |
| `npm run visual` | The visual check (below). Run by hand, not by a hook or CI (below) |
| `npm run visual:update` | Rewrites the Convert image framing screenshots, the only ones the Playwright runner itself owns; the others are read from `e2e/visual/__screenshots__` as they are, and change only when the look is meant to (delete and regenerate them deliberately) |
| `npm run perf` | The performance check (below). By hand, never in CI |

### Visual check

Renders fixture Projects in a real browser (Playwright, Chromium) and compares the drawn grid with the reference screenshots in `e2e/visual/__screenshots__`: loom, peyote and brick stitch; Row progress in both directions; a Selection; a paste preview; Mirror axes and the "Mirror current" dimming; hover previews; and the Convert image framing preview. Each Project scenario is shot at 25%, 100% and 300% zoom, upright and rotated. Only the grid is compared, not the rulers or other text, since fonts differ between machines and the beads do not.

Those references were made from the one-element-per-bead grid the renderer replaced (ticket 103), and are what the renderer is held to ("visually indistinguishable", ADR 0018). A canvas never lands on exactly the same pixels as the DOM did, so the comparison is two checks (`e2e/support/referenceCheck.ts`): a look check (both images reduced to the average color of blocks a fraction of a bead wide, at most a per-Technique share of blocks may differ) and a content check (every bead's centre is its color, finished rows' greys included). `e2e/visual/look.spec.ts` runs them on the app for every Technique, plain and with Row progress in both directions, at every zoom, upright and rotated; `overlays.spec.ts` for the Selection, paste preview, Mirror axes and dimming; `interaction.spec.ts` for the hover preview and for the pointer tools (paint, erase, Fill, Row progress lock, Mirror, Undo, Space-drag pan, a touch stroke); `framing.spec.ts` for the Convert image framing preview; `large-projects.spec.ts` for 70 × 250 and 250 × 250 Projects end to end. The check tests itself: `look.spec.ts` renders Projects with a bead recolored or missing, and a Row progress marker the reference does not have, and expects the comparison to fail.

The first run needs the browser: `npx playwright install chromium`. The references are made and checked on Linux, the platform CI runs; on another OS, small rendering differences can fail the check locally. To look at a failure, open `playwright-report/index.html` (`npx playwright show-report`). CI does not run it (see Tests before a push).

### Tests before a push

GitHub Actions minutes are kept for deployments (ADR 0029). CI runs nothing on pull requests; the deploy workflow's build (`vue-tsc` and `vite build`) is its only check. Typecheck, lint and the tests run on your machine: `npm install` points git at `.githooks/`, the `pre-push` hook runs `npm run typecheck`, `npm run lint`, `npm test` and `npm run visual` in full whenever the push changes `src/`, `e2e/` or the files that build them. A full unit run peaks near 1.5 GB of RAM and takes several minutes on a Raspberry Pi. The hooks cap Node's heap at 1536 MB (`PREPUSH_NODE_HEAP_MB`) and, when a systemd user session exists, the run's memory at 3 GB (`PREPUSH_MEMORY_MAX`); without one it says so and runs uncapped. `--no-verify` on `git push` skips it; say so in the PR if you do.

### Performance check

`npm run perf` builds the app and drives it at a chosen CPU slowdown, printing frames per second and main-thread time for hovering, painting a stroke, scrolling, a zoom step, opening a Project and dragging the Convert image framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop, "the floor") and at 6×. Options are environment variables: `PERF_SLOWDOWNS=4`, `PERF_SIZES=70x250`, `PERF_ONLY=hover,paint`, `PERF_TECHNIQUES=loom,peyote,brick` for the framing drag (see the top of `e2e/perf/perf.spec.ts`). Run it on an otherwise idle machine; timings vary from run to run, so compare numbers taken the same way. Targets: 60 fps for hover, paint and pan at 250×250 on an iPad Air 13″; at least 30 fps at the floor at 70×250 and 250×250; opening a Project in about 200 ms; a smooth framing drag.
