# Coding standards

What a change in this repo must follow, for whoever writes it and whoever reviews it. Each rule points to the ADR or doc that explains it; read that before arguing with the rule. Words for domain concepts come from [`CONTEXT.md`](CONTEXT.md); how things look comes from [`DESIGN.md`](DESIGN.md). Testing has its own page: [`docs/testing.md`](docs/testing.md).

## Where new code goes

- **Layers** ([ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md)): `domain/` is pure TypeScript (no Vue, no browser globals, no `i18n/`); `services/` is the only code that reaches outside the page (storage, files, download); `composables/` call domain and services; `components/` never import services, they emit events or take what they need from props; `rendering/` draws on a canvas with no Vue and no services.
- **Feature folders** ([ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md)): `components/<feature>/` and `composables/<feature>/`, with features `canvas`, `tools`, `palette`, `export`, `import`, `project`, `shell`, `tour`. `components/ui/` holds the primitives and imports from no feature folder. No composable imports from a component, types included.
- **App.vue stays a composition root** ([ADR 0020](docs/adr/0020-module-boundaries-and-a-services-layer.md)): new behavior is a composable (a user flow is a `use<Name>Flow`) wired in `useAppShell`, not logic in `App.vue` or `AppShell.vue`. CSS moves with its markup.
- Browser-only parts of the theme and language live in `theme/` and `i18n/`; the marketing page in `overview/`.

## Rules every change keeps

- **Every undoable change goes through `edit`** ([ADR 0036](docs/adr/0036-every-undoable-change-goes-through-edit.md)): a flow receives `edit` (from `useEdit`) and calls `edit(kind, project => result)` with kind `drawing`, `frame` or `exempt`. It never calls `replaceProject` or records history itself, and never re-checks the Row progress lock or the margin (ask `mayPlace`).
- **Controls come from the registry and the shared components** ([ADR 0035](docs/adr/0035-one-control-registry-and-shared-controls.md)): an action is defined once in `composables/shell/controlRegistry.ts` (id, icon, name, Tooltip body, keys, `enabled`, `disabledBody`, `run`), and its keyboard shortcut comes from there. Render it with `IconButton`, `AppButton`, `MenuButton` or `AppSwatch` from `components/ui/`; text that must always be readable is an `AppNote`. No native `title`, no hand-built tooltip; a control that can be disabled gives a `disabledBody` and uses `aria-disabled`.
- **Every user-facing string is in every language** (English, Russian, Ukrainian, Belarusian, Chinese, Spanish, Polish): add the key to the `Translations` interface in `src/i18n/translations.ts`, then to `en.ts`, `ru.ts`, `uk.ts`, `be.ts`, `zh.ts`, `es.ts` and `pl.ts` (a missing one fails the type check). A counted word lists the forms its language needs (`one`/`other` for English, `one`/`few`/`many` for Russian, Ukrainian, Belarusian and Polish, `one`/`many`/`other` for Spanish, `other` for Chinese). Counts go through `plural()`. Wording follows the design system's [`writing.md`](docs/design/system/writing.md), including its Russian section. Tickets, code and comments are English only.
- **No hardcoded colors, fonts, sizes or shadows**: use the role-named tokens (`docs/design/system/tokens.json`, as CSS custom properties from `src/styles/`). A need the design system doesn't cover is added to it in the same commit (`DESIGN.md` §6). Icons, logo and favicon come from `docs/design/system/`, never redrawn.
- **Stored data stays readable**: a change to how a Project or library is saved or encoded keeps every old format opening (see `docs/testing.md`, Stored-data compatibility).
- **A decision that a later reader would question gets an ADR** (`docs/adr/`, next free number, see `docs/agents/domain.md`); a contradiction with an existing ADR is called out, not made silently.

## Naming and comments

- Name things with the glossary's terms (`CONTEXT.md`): Project, Pattern, Frame, Piece, Bead, Palette, Row progress. Code identifiers use US spelling (`color`); UI copy follows `writing.md`.
- Composables are `use<Name>`; a flow's dependencies come in as one `<Name>Deps` object. Components are PascalCase and multi-word.
- Every exported function, composable and component gets a short `/** */` comment saying what it is for and why, in domain words, citing the ticket or ADR when the reason lives there (see `useRotateFlow.ts`). Don't comment what the code already says; don't leave commented-out code or TODOs without a ticket number.
- Match the file you're in: long lines (about 120 characters), no semicolons, single quotes, `import type` for types.

## Already enforced, so reviewers skip them

- **ESLint** (`npm run lint`, `eslint.config.js`): the typescript-eslint recommended set and Vue essential rules; unused variables (prefix `_` for a deliberate one); multi-word component names; the layer boundaries above (`domain/` imports no Vue, services or UI and touches no `window`, `navigator`, `localStorage`, `fetch` or `document`; `rendering/` imports no Vue or services; `components/` import no services; `components/ui/` imports no feature folder).
- **The type check** (`npm run typecheck`): a translation missing in either language, an undoable flow reaching for `replaceProject`.
- **Unit tests that guard rules**: in `controlRegistry.test.ts`, two actions with the same key, an action without a name in both languages, a disableable action without a `disabledBody`, a Tooltip body that isn't one sentence ending in a full stop; token values out of step with the design system (`src/styles/tokens.test.ts`); the RU file using an em dash (`useI18n.test.ts`).
- **The visual check**: text or a Tooltip cut off in any language or width, and hover text made any way but the Tooltip (`docs/testing.md`, Text fit check).
- **knip** (`npm run knip`, run by CI with lint): unused files, exports and dependencies.
