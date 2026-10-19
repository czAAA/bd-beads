# Context: bd-beads

**bd-beads** is a personal tool for designing and tracking beadwork Projects (hand weaving and loom weaving).

**Public name:** people see **openbeads** (ticket 401), set in the slogan's serif. `bd-beads` stays the code, repo, storage-key and file-kind name until the repo is renamed; only visible text changed.

## Quick start

- **Issue tracker**: `.scratch/` (markdown, in the private docs repo `bd-beads-docs`, linked in; ADR 0047)
- **Architecture decisions**: `docs/adr/` (also in the docs repo, linked in)
- **Agent skills config**: `docs/agents/`
- **Coding standards**: [CODING_STANDARDS.md](CODING_STANDARDS.md); testing in [docs/testing.md](docs/testing.md)

## What is this app?

bd-beads lets a single user design beadwork Projects for hand weaving (peyote, brick stitch) and loom weaving: set a Frame's size in beads (or mm/cm, converted once to beads), paint on the canvas using a Palette, and later track weaving progress row by row against a catalog of real Beads. It's a personal tool, not a multi-user product, today — see ADR 0001; ADR 0014 lays out the planned hosted phase and why it's deliberately not part of this release.

## Key concepts

- **Project**: everything saved under one name — one Canvas holding 0–1 Frame, Pieces and unframed Schemas (see [Language](#language) below)
- **Piece** and **Schema**: a Piece is a small independent set of touching beads on the Canvas; a Piece that has a Frame or a name is a Schema. The framed Schema, the beads inside the Project's Frame, is what Export, Beads needed, Row progress and Rotate act on — see ADR 0050
- **Palette** and **Bead catalog**: kept as separate concepts — a cell's color is not required to match a real Bead — see ADR 0002, amended by ADR 0007 (dropped the color-to-bead mapping; a Project now has exactly one Bead)
- **Technique**: determines a Project's grid geometry (loom, peyote, brick stitch)
- **Row progress**: an in-editor overlay for tracking which rows are already woven, running along the grid's rows or down its columns (Row direction), with finished rows locked against drawing
- **Schema size**: the Frame's columns × rows in beads; the mm shown is only an estimate, and Replace Bead keeps every bead — see ADR 0026 and ADR 0007. There is no limit on size beyond what the device can hold (ADR 0019, which removed the cell cap)
- **Bead quantities**: the per-color bead counts a Schema needs, counted straight from its painted colors (with an Estimated weight beside them) — see ADR 0007
- **Project file**: the exported `.openbeads` file (JSON with the compact bead encoding, gzipped) holding one Project (`my-scarf_pr.openbeads`) or a whole library (`openbeads_lib.openbeads`) — the only way work moves between devices, per ADR 0001 and ADR 0048. Plain `.json` files from before ADR 0048 still import
- **Convert image**: a second way to create a Project — from a picture rather than an empty grid, with the picture becoming the Schema, cropped to the Schema's real-world size (ADR 0010, amended by ADR 0026)
- **Visual language**: how the app looks — light, dark and high contrast themes, tokens, layout, components, copy and artwork — is set by the design system in `docs/design/system/` (owned by the repo, baseline v18), entered through [DESIGN.md](DESIGN.md); see ADR 0021, amended by ADR 0030. The App shell layout below is the redesigned one (ticket 141); the redesign tickets restyle its parts
- **App shell layout**: how the screen is arranged — the **Tool pill layout** at every width: the canvas box is the screen (6px from every edge), the Tool pill floating over its drawing area, sheets for the controls, the slim Canvas strip (ADR 0021, ADR 0032, ADR 0046, ADR 0059; the Toolbox layout was removed in ticket 412). The full arrangement is in [docs/layout.md](docs/layout.md)
- **Text fit check**: the browser check, part of `npm run visual`, that no text or Tooltip is cut off or pokes out of its box in any language at any supported width; how it works and how to extend it is in [docs/testing.md](docs/testing.md#text-fit-check)

## Language

The full glossary, with the words to avoid for each term, lives in [docs/glossary/](docs/glossary/README.md), one file per area. Grep it for the term you need rather than reading it all; use its terms in tickets, tests and code.

| Area | Terms |
|---|---|
| [Canvas and Frame](docs/glossary/canvas-and-frame.md) | Project, Schema, Canvas, Grid, Position marks, Piece, Piece area, Frame, Keep-out margin, Edit Frame, Move handle, Hand tool, Pen mode, Rulers toggle, Canvas zoom, Page zoom, Zoom floor, Ruler step, Ruler dot, Ruler layout, Canvas color |
| [Library, Palette and Beads](docs/glossary/library-palette-beads.md) | Project library, Maker's name, Palette, Bead, Bead color, Color catalog, Form factor, Bead shape, Technique, Right-angle weave, Netting, Net size, Unit |
| [Row progress](docs/glossary/row-progress.md) | Row progress, Pass, Row direction, Progress bar |
| [Tool pill and controls](docs/glossary/toolbox.md) | Tool group, Tool pill layout, Tool pill, Menu, Panel sub-view, Canvas strip, Tool button, Tooltip, Note |
| [Editing a Schema](docs/glossary/editing.md) | Eraser, Clear, Schema size, Rotate, Beads needed, Estimated size, Estimated weight, Remove row/column, Replace Bead, Custom color, Selection, Piece tool, Select all, Copy, Paste, Undo, Redo |
| [Import and rendering](docs/glossary/import-and-rendering.md) | Convert image, Project renderer, Drawing surface, Bead pointer |
| [Accounts and sharing](docs/glossary/accounts-and-sharing.md) | View link, Guest, Free account, Pro, Sign-in method, Edit link, Locked Project, Sync pending, Surface view |
| [Overview and Tour](docs/glossary/overview-and-tour.md) | Overview, Tour |

## How to run it

`npm install`, then `npm run dev` (Vite) and open the URL it prints; `npm run build` makes `dist/`. Every check (`npm test`, `npm run typecheck`, `npm run lint`, `npm run visual`, `npm run perf`) is in the README's [Checks](README.md#checks). While working, run only the tests related to your change (`npx vitest related --run <files>`), never the full suite by hand; CI runs it on every pull request. How tests are written: [docs/testing.md](docs/testing.md); what a change must follow: [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Where to start

`src/`, by layer (ADR 0020, feature folders inside the layers):

| Folder | What is there | Start with |
|---|---|---|
| `domain/` | Pure logic and data: Project, Frame, Pieces, Techniques, Row progress, Selection, history, encodings and file formats | `project.ts`, `changeFrame.ts`, `projectFile.ts` |
| `rendering/` | Drawing on a canvas, shared by the editor, previews and exports: the Project, overlays, rulers, print pages | `projectRenderer.ts`, `overlayRenderer.ts` |
| `services/` | The only code that reaches outside the page: the Project library in localStorage, preferences, image decoding, file download | `index.ts`, `libraryStore.ts` |
| `composables/<feature>/` | The app's behavior, one composable per concern; user flows are `use<Name>Flow` | `shell/useAppShell.ts` (wires them all), `project/useEdit.ts`, `shell/controlRegistry.ts` |
| `components/<feature>/` | The Vue components for each feature: `canvas`, `tools`, `palette`, `export`, `import`, `project`, `shell`, `tour` | `shell/AppShell.vue` |
| `components/ui/`, `composables/ui/` | Primitives every feature builds on: `IconButton`, `AppButton`, `MenuButton`, `AppSwatch`, `AppNote`, `AppTooltip`, modals, menus, form fields; generic composables | `controlAction.ts` |
| `i18n/` | One typed dictionary per language (English, Russian, Ukrainian, Belarusian, Chinese, Spanish, Polish), plurals, the language switch | `translations.ts`, `en.ts`, `ru.ts`, `uk.ts`, `be.ts`, `zh.ts`, `es.ts`, `pl.ts` |
| `theme/` | Light, dark and high contrast, following the device | `theme.ts` |
| `styles/` | Tokens and shared CSS, from the design system | `tokens.css`, `design-values.css` |
| `overview/` | The Overview page a new visitor lands on (its own entry, `overview/index.html`) | `OverviewPage.vue`, `overviewRoute.ts` |
| `pwa/` | The offline shell's service worker, which `vite.pwa.ts` writes into the build as `sw.js` with the list of built files (ADR 0045); its page-side half is `services/offlineShell.ts` | `serviceWorker.js` |
| `testUtils/` | Shared test helpers ([docs/testing.md](docs/testing.md)) | `seedProject.ts`, `editHarness.ts` |

Entry files: `src/main.ts` (picks the Overview or the editor, mounts `App.vue`), `src/App.vue` (pure composition, ADR 0020), `src/features.ts` (switched-off features). Browser checks live in `e2e/`. Where things sit on screen: [docs/layout.md](docs/layout.md).
