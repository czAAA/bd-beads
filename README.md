# bd-beads
beads drawing app

Open source under the GNU Affero General Public License v3.0 or later (see [LICENSE](LICENSE)); see [ADR 0031](docs/adr/0031-public-agpl-3-license.md) for why. Issues are welcome; outside contributions (pull requests) are not accepted yet.

Hosted privately (tailnet only); see [ADR 0022](docs/adr/0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md).

## Deploy

The build is served from the owner's Flint 2 router, reachable only over Tailscale; see [ADR 0022](docs/adr/0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md) for why and what a new host would need. Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it tests and builds the app, joins the tailnet as `tag:ci` and rsyncs `dist/` to the router. No manual deploy step is needed. A run can also be started by hand from the Actions tab ("Run workflow").

The host and path come from a `production` GitHub Actions environment, not the workflow; its deployment branches are limited to `main`, so no other workflow or branch can read them (see ADR 0022's one-time setup). Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`. Variables: `DEPLOY_PATH` (with a trailing slash), `DEPLOY_BASE` (the URL path the app is served from, default `/bd-beads/`). Don't set `DEPLOY_BASE` when running `npm run visual` locally; the browser checks expect the default.

## Checks

| Command | What it checks |
| --- | --- |
| `npm test` | Unit and component tests (Vitest, jsdom). Includes the stored-data compatibility test, `src/domain/compatibility.test.ts`, which opens libraries and Project files in every format the app has written (version 1 and 2 libraries, single-Project and whole-library files, a Project past the old 10,000-cell cap) from the literal fixtures in `src/domain/fixtures/` |
| `npm run typecheck` | Type-checks the app, the build config and the browser checks |
| `npm run lint` | ESLint |
| `npm run visual` | The visual check (below). Run on every pull request by CI (below) |
| `npm run visual:update` | Rewrites the Convert image framing screenshots, the only ones the Playwright runner itself owns; the others are read from `e2e/visual/__screenshots__` as they are, and change only when the look is meant to (delete and regenerate them deliberately) |
| `npm run perf` | The performance check (below). By hand, never in CI |

### Visual check

Renders fixture Projects in a real browser (Playwright, Chromium) and compares the drawn grid with the reference screenshots in `e2e/visual/__screenshots__`: loom, peyote and brick stitch; Row progress in both directions; a Selection; a paste preview; Mirror axes and the "Mirror current" dimming; hover previews; and the Convert image framing preview. Each Project scenario is shot at 25%, 100% and 300% zoom, upright and rotated. Only the grid is compared, not the rulers or other text, since fonts differ between machines and the beads do not.

Those references were made from the one-element-per-bead grid the renderer replaced (ticket 103), and are what the renderer is held to ("visually indistinguishable", ADR 0018). A canvas never lands on exactly the same pixels as the DOM did, so the comparison is two checks (`e2e/support/referenceCheck.ts`): a look check (both images reduced to the average color of blocks a fraction of a bead wide, at most a per-Technique share of blocks may differ) and a content check (every bead's centre is its color, finished rows' greys included). `e2e/visual/look.spec.ts` runs them on the app for every Technique, plain and with Row progress in both directions, at every zoom, upright and rotated; `overlays.spec.ts` for the Selection, paste preview, Mirror axes and dimming; `interaction.spec.ts` for the hover preview and for the pointer tools (paint, erase, Fill, Row progress lock, Mirror, Undo, Space-drag pan, a touch stroke); `framing.spec.ts` for the Convert image framing preview; `large-projects.spec.ts` for 70 × 250 and 250 × 250 Projects end to end. The check tests itself: `look.spec.ts` renders Projects with a bead recolored or missing, and a Row progress marker the reference does not have, and expects the comparison to fail.

The first run needs the browser: `npx playwright install chromium`. The references are made and checked on Linux, the platform CI runs; on another OS, small rendering differences can fail the check locally. To look at a failure, open `playwright-report/index.html` (`npx playwright show-report`). CI runs it on every pull request (see CI).

### CI

CI is the gate (`docs/testing.md`, CI). Every pull request to `main` runs typecheck and lint, the unit tests and the visual check on GitHub, and branch protection requires the aggregate checks "Typecheck and lint", "Unit tests passed" and "Visual check passed". A PR that changes only `.scratch/` or Markdown skips them. A failed visual run uploads its report as an artifact. While working, run only the tests related to your change (`npx vitest related --run <files>`); a full unit run peaks near 1.5 GB of RAM, so leave the full suite to CI.

### Performance check

`npm run perf` builds the app and drives it at a chosen CPU slowdown, printing frames per second and main-thread time for hovering, painting a stroke, scrolling, a zoom step, opening a Project and dragging the Convert image framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop, "the floor") and at 6×. Options are environment variables: `PERF_SLOWDOWNS=4`, `PERF_SIZES=70x250`, `PERF_ONLY=hover,paint`, `PERF_TECHNIQUES=loom,peyote,brick` for the framing drag (see the top of `e2e/perf/perf.spec.ts`). Run it on an otherwise idle machine; timings vary from run to run, so compare numbers taken the same way. Targets: 60 fps for hover, paint and pan at 250×250 on an iPad Air 13″; at least 30 fps at the floor at 70×250 and 250×250; opening a Project in about 200 ms; a smooth framing drag.
