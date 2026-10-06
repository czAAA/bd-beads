# 311: Run knip in CI, and remove the dead code it finds

**What to build:** Add knip (unused files, exports, dependencies) as a dev dependency with a config, run it in CI, and remove what it finds, so dead code can't pile up again. A trial run on 2026-10-06 (`npx knip`, and `npx knip --production` to exclude tests) found no unused npm dependencies, but did find:

- **Used only by tests (likely dead):** `domain/rulerStick.ts`, `rendering/surfaceWindow.ts`; the string-based twin of the image conversion pipeline in `domain/imageConversion.ts`/`imageFraming.ts` (`sampleLattice`, `convertSampledFrame`, `convertImage`, `previewColorOutsideFrame`, `pixelColorAt`, `sourcePixelAt`; production uses `sampleLatticePacked` + `convertPackedFrame`, and the twin's tests only check that the two agree); `qrExport.fitsInQrCode` (its comment claims it guards the export button, which actually uses `projectQrMatrix`); `project.toggleRotated` (the view-only rotation that ADR 0026 replaced); `hitTest.beadAt`; `draftRenderer.draftImage`; `selection.isWithinSelection` and `pastedCells`.
- **About 40 constants and functions exported but used only inside their own file** (e.g. in `rulers.ts`, `printPlan.ts`, `beadLook.ts`, `projectExport.ts`, the `*_STORAGE_KEY`s): drop the `export`, unless a test needs it, in which case keep it.
- **64 exported types never imported elsewhere**, mostly composables' `*Deps` interfaces.

Each finding gets a judgment, not a blanket delete. Test-only code is deleted with its tests when nothing in production needs it, keeping any behaviour test that production code also goes through. Constants a test legitimately reads stay exported. Not in scope: `components/tools/MirrorControls.vue` (Mirror is kept and will move to its own module, candidate D4, so leave it and list it in knip's ignore with that reason), and the switched-off Tour (leave it alone).

Config notes from the trial run: the Overview is a second Vite entry (`overview/index.html` → `src/overview/overview.ts`, see `vite.config.ts` `rollupOptions.input`), so knip must be told about it, or it reports the whole Overview as unused. Test helpers (`src/testUtils/*`, `src/testSetup.ts`, `e2e/support/*`) are test entries. Run knip as a step inside the existing "Typecheck and lint" job (an `npm run knip` script), so the required check names in `ci.yml` don't change. Candidate G4 of the architecture review of 2026-10-05.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] `knip` is a dev dependency with a checked-in config naming both Vite entries, the Vitest and Playwright test entries, and any deliberate ignores, each with a one-line reason
- [ ] `npm run knip` exits 0 on the branch and runs as a step of the "Typecheck and lint" CI job; no required check is renamed
- [ ] The test-only modules and exports above are deleted (or kept with a reason in the config), along with tests that only tested deleted code
- [ ] Exports used only within their file are no longer exported, except where a test reads them
- [ ] Decide in the config whether unused exported types are reported; if they are, fix them; if not, say why
- [ ] Typecheck, lint, unit tests and the visual check pass in CI
