# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Projects (hand weaving and loom weaving).

## Quick start

- **Issue tracker**: `.scratch/` (local markdown)
- **Architecture decisions**: `docs/adr/`
- **Agent skills config**: `docs/agents/`
- **Coding standards**: [CODING_STANDARDS.md](CODING_STANDARDS.md); testing in [docs/testing.md](docs/testing.md)

## What is this app?

bd-beads lets a single user design beadwork Projects for hand weaving (peyote, brick stitch) and loom weaving: set a Frame's size in beads (or mm/cm, converted once to beads), paint on the canvas using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product, today — see [ADR 0001](docs/adr/0001-local-only-persistence.md); [ADR 0014](docs/adr/0014-mvp-stays-local-only-hosted-phase-deferred.md) lays out the planned hosted phase and why it's deliberately not part of this release.

## Key concepts

- **Project**: everything saved under one name — an Open canvas of Pieces with a Frame on it (see [Language](#language) below)
- **Pattern**: only the beads inside a Project's Frame, which is what Export, Beads needed, Row progress and Rotate act on
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see [ADR 0002](docs/adr/0002-palette-separate-from-bead-catalog.md), amended by [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md) (dropped the color-to-bead mapping; a Project now has exactly one Bead)
- **Technique**: determines a Project's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Mirror**: a symmetric-drawing aid, live while painting — see [ADR 0006](docs/adr/0006-live-mirror-while-drawing.md)
- **Pattern size**: the Frame's columns × rows in beads; the mm shown is only an estimate, and Replace Bead keeps every bead — see [ADR 0026](docs/adr/0026-open-canvas-and-frame.md) and [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md). There is no limit on size beyond what the device can hold ([ADR 0019](docs/adr/0019-a-pattern-has-no-size-limit.md), which removed the cell cap)
- **Bead quantities**: the per-color bead counts a Pattern needs, counted straight from its painted colors (with an Estimated weight beside them) — see [ADR 0007](docs/adr/0007-one-bead-per-pattern-no-color-mapping.md)
- **Project file**: the exported `.json` holding one Project or a whole library — the only way work moves between devices, per [ADR 0001](docs/adr/0001-local-only-persistence.md)
- **Convert image**: a second way to create a Project — from a picture rather than an empty grid, with the picture becoming the Pattern, cropped to the Pattern's real-world size ([ADR 0010](docs/adr/0010-convert-image-fixed-physical-size.md), amended by [ADR 0026](docs/adr/0026-open-canvas-and-frame.md)) with its colors saved as Image colors ([ADR 0011](docs/adr/0011-image-colors-stored-frozen.md))
- **Visual language**: how the app looks — light, dark and high contrast themes, tokens, layout, components, copy and artwork — is set by the design system in `docs/design/system/` (owned by the repo, baseline v18), entered through [DESIGN.md](DESIGN.md); see [ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), amended by [ADR 0030](docs/adr/0030-the-repo-owns-the-design-system.md). The App shell layout below is the redesigned one (ticket 141); the redesign tickets restyle its parts
- **App shell layout**: how the screen is arranged — at 1024px and wider a header, the left column (Toolbox, save box, Beads needed, Saved Projects) and the canvas box; under 1024px the phone layout, with the canvas on top and the Dock below it ([ADR 0021](docs/adr/0021-visual-language-follows-design-md.md), [ADR 0032](docs/adr/0032-everything-under-1024px-is-the-phone-layout.md)). The full arrangement is in [docs/layout.md](docs/layout.md)
- **Text fit check**: the browser check, part of `npm run visual`, that no text or Tooltip is cut off or pokes out of its box in any language at any supported width; how it works and how to extend it is in [docs/testing.md](docs/testing.md#text-fit-check)

## Language

The full glossary, with the words to avoid for each term, lives in [docs/glossary/](docs/glossary/README.md), one file per area. Grep it for the term you need rather than reading it all; use its terms in tickets, tests and code.

| Area | Terms |
|---|---|
| [Canvas and Frame](docs/glossary/canvas-and-frame.md) | Project, Pattern, Open canvas, Grid, Position marks, Piece, Piece area, Frame, Keep-out margin, Set Frame, Hand tool, Pen mode, Rulers toggle, Canvas zoom, Page zoom, Zoom floor, Ruler step, Ruler dot, Ruler layout, Canvas color |
| [Library, Palette and Beads](docs/glossary/library-palette-beads.md) | Project library, Maker's name, Palette, Bead, Bead color, Color catalog, Form factor, Technique |
| [Row progress and Mirror](docs/glossary/row-progress-and-mirror.md) | Row progress, Pass, Row direction, Progress bar, Mirror |
| [Toolbox and controls](docs/glossary/toolbox.md) | Toolbox, Tool group, Dock, Menu, Zoom pill, Tool button, Tooltip, Note |
| [Editing a Pattern](docs/glossary/editing.md) | Eraser, Clear, Pattern size, Rotate, Beads needed, Estimated size, Estimated weight, Remove row/column, Replace Bead, Custom color, Selection, Copy, Paste, Undo, Redo |
| [Import and rendering](docs/glossary/import-and-rendering.md) | Convert image, Image colors, Project renderer, Drawing surface, Bead pointer |
| [Accounts and sharing](docs/glossary/accounts-and-sharing.md) | View link, Guest, Free account, Pro, Edit link, Locked Project, Sync pending, Surface view |
| [Overview and Tour](docs/glossary/overview-and-tour.md) | Overview, Tour |

## How to run it

`npm install`, then `npm run dev` (Vite) and open the URL it prints; `npm run build` makes `dist/`. Every check (`npm test`, `npm run typecheck`, `npm run lint`, `npm run visual`, `npm run perf`) is in the README's [Checks](README.md#checks). While working, run only the tests related to your change (`npx vitest related --run <files>`), never the full suite by hand; CI runs it on every pull request. How tests are written: [docs/testing.md](docs/testing.md); what a change must follow: [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Where to start

`src/`, by layer ([ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md), feature folders inside the layers):

| Folder | What is there | Start with |
|---|---|---|
| `domain/` | Pure logic and data: Project, Frame, Pieces, Techniques, Row progress, Mirror, Selection, history, encodings and file formats | `project.ts`, `changeFrame.ts`, `projectFile.ts` |
| `rendering/` | Drawing on a canvas, shared by the editor, previews and exports: the Project, overlays, rulers, print pages | `projectRenderer.ts`, `overlayRenderer.ts` |
| `services/` | The only code that reaches outside the page: the Project library in localStorage, preferences, image decoding, file download | `index.ts`, `libraryStore.ts` |
| `composables/<feature>/` | The app's behavior, one composable per concern; user flows are `use<Name>Flow` | `shell/useAppShell.ts` (wires them all), `project/useEdit.ts`, `shell/controlRegistry.ts` |
| `components/<feature>/` | The Vue components for each feature: `canvas`, `tools`, `palette`, `export`, `import`, `project`, `shell`, `tour` | `shell/AppShell.vue` |
| `components/ui/`, `composables/ui/` | Primitives every feature builds on: `IconButton`, `AppButton`, `MenuButton`, `AppSwatch`, `AppNote`, `AppTooltip`, modals, menus, form fields; generic composables | `controlAction.ts` |
| `i18n/` | One typed dictionary per language (English, Russian, Ukrainian, Belarusian, Chinese, Spanish, Polish), plurals, the language switch | `translations.ts`, `en.ts`, `ru.ts`, `uk.ts`, `be.ts`, `zh.ts`, `es.ts`, `pl.ts` |
| `theme/` | Light, dark and high contrast, following the device | `theme.ts` |
| `styles/` | Tokens and shared CSS, from the design system | `tokens.css`, `design-values.css` |
| `overview/` | The Overview page a new visitor lands on (its own entry, `overview/index.html`) | `OverviewPage.vue`, `overviewRoute.ts` |
| `pwa/` | The offline shell's service worker, which `vite.pwa.ts` writes into the build as `sw.js` with the list of built files ([ADR 0045](docs/adr/0045-the-offline-shell-is-a-hand-written-service-worker.md)); its page-side half is `services/offlineShell.ts` | `serviceWorker.js` |
| `testUtils/` | Shared test helpers ([docs/testing.md](docs/testing.md)) | `seedProject.ts`, `editHarness.ts` |

Entry files: `src/main.ts` (picks the Overview or the editor, mounts `App.vue`), `src/App.vue` (pure composition, [ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md)), `src/features.ts` (switched-off features). Browser checks live in `e2e/`. Where things sit on screen: [docs/layout.md](docs/layout.md).
