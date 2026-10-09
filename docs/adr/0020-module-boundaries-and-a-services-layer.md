# Code is layered by role, grouped by feature inside the layers, and composed in one root

**Status: accepted.** Tickets 65, 206, 207, 225. `CODING_STANDARDS.md` lists the rules as a reviewer checks them.

## Layers

1. **`domain/`** is pure TypeScript: no Vue, no `window`, `navigator`, `localStorage`, `fetch`, `document`, and nothing from `i18n/` (`Locale` and number formatting live in `domain/`).
2. **`services/`** is the only code that reaches outside the page's memory: device storage (the Project library and every device preference), files a person picks (image decoding), download and share, and later the backend API ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)). Each service is a small interface with a local implementation; the backend phase adds remote ones rather than rewriting callers.
3. **`composables/`** hold state and gestures that need Vue's reactivity, and call `domain/` and `services/`, never `fetch` or `localStorage` directly. `theme/` and `i18n/` follow the same rule.
4. **`components/`** are presentation and never import services: they emit events, or take what they need from props or the app-shell context.
5. **`rendering/`** draws, with no Vue and no services, so one drawing serves the editor, the preview and the exports ([ADR 0018](0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)). Making its own scratch canvas is drawing, not a service.

Backend code lives under `services/` (for example `services/api/`); its types and wire format live in `domain/`. Composable tests use a fake service instead of stubbing `localStorage`.

## Feature folders

Inside `components/` and `composables/`, files sit in mirrored feature folders: `ui/` (primitives and generic composables), `canvas/`, `tools/`, `palette/`, `export/`, `import/`, `project/`, `shell/` (composition roots and chrome), `tour/`. Features don't import each other; they meet in the composition roots. `components/ui/` imports from no feature folder (ESLint enforces it), and no composable imports from a component, types included.

## One composition root

`composables/shell/useAppShell.ts` creates every composable and provides them as one flat, typed context (`provideAppShell` / `useAppShell`) whose type is the wiring's own return type, so a component can't ask for something that isn't wired. `App.vue` only calls `provideAppShell()` and renders `AppShell.vue`, which composes the shell's parts; each part carries the CSS of the markup it owns. New behavior is a composable wired there (a user flow is a `use<Name>Flow`), never logic in `App.vue` or `AppShell.vue`.

## Considered options

- API code inside composables (rejected: every composable would know about network failure, auth and retries).
- Small preferences keeping their own `localStorage` helpers (rejected: one rule with no exceptions is easier to keep and check).
- `imageDecode` in `rendering/` or `domain/` (rejected: decoding is input, not drawing).
- Colocated feature modules (`features/export/` holding components, composables and domain) (rejected: features share the domain core and the primitives and meet only in the roots, so full modules add folders, not boundaries).
- Flat layers (rejected: over a hundred files in two folders).
