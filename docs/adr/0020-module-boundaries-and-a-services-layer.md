# Modules by role, with a services layer for anything that leaves the device

**Status: accepted (ticket 65).** Amended by ADR 0024 (feature subfolders inside `components/` and `composables/`). Written from a walk through the code by the agent, then refreshed after the App.vue split (ADR 0023) and agreed with a person before backend work (tickets 71, 78, 84, 85) builds on it.

## What the code is today

`src/` already separates by role, and the imports mostly run one way:

- `domain/` — Pattern, grid geometry, palette, beads, history, selection, conversion, file and QR encodings. Plain TypeScript, no Vue. Four files still touch the browser and are really services: `patternStorage.ts` and `makerName.ts` (its `loadMakerName`/`saveMakerName`) read and write `localStorage`, `fileDownload.ts` triggers a download or share, and `imageDecode.ts` decodes a picked image file through a DOM `img` and `canvas`.
- `rendering/` — the Pattern renderer, overlay, sprites, and (ticket 73/74) the PNG/PDF export drawing. Depends on `domain/`, draws on a canvas it is handed or makes.
- `composables/` — state and gestures that need Vue's reactivity (`usePatternLibrary`, `usePatternZoom`, `useSelectionGesture`, `useExportFlow`, …). Depend on `domain/`. `useAppShell` is the composition root: it creates every composable and provides them to the shell components as one typed context (ADR 0023).
- `components/` — presentation; `App.vue` only calls `provideAppShell()` and renders `AppShell.vue`. One component reaches past this: `PatternList.vue` calls `downloadFile` itself for its two export buttons. `NewPatternForm.vue` and `PatternImport.vue` default their `DecodeImage` to the browser decoder.
- `theme/` and `i18n/` — the theme and translations. Each keeps its device preference in `localStorage` directly (`theme.ts`, `useThemePick.ts`, `localeStorage.ts`).

## Decision

Keep that layering, make it a rule, and add one layer:

1. **`domain/` is pure.** No Vue, no `window`, `navigator`, `localStorage`, `fetch` or `document`. The browser parts of the four files above move out (below); their pure parts, such as `normalizeMakerName` and `MAX_MAKER_NAME`, stay.
2. **`services/`** is new, and is the only place that talks to something outside the page's own memory: the device's storage (the Pattern library, and the theme, language and maker-name preferences), files the person picks (image decoding), file download and share, and, in the backend phase, the API (accounts, sync, billing, hosted links). Each service is a small interface with a browser/local implementation and, later, a remote one, so the app can be built and tested against the local one and the backend phase swaps or adds implementations rather than rewriting callers.
3. **`composables/` call services and domain, never `fetch` or `localStorage` directly.** `usePatternLibrary` is the seam the sync work extends: it keeps the Pattern library in memory and persists through a library-store service. `theme/` and `i18n/` follow the same rule for their preferences.
4. **`components/` never import services.** They emit events, or take what they need (such as a `DecodeImage`) from props or the app-shell context; `useAppShell` and the composables it wires do the work.
5. **`rendering/` stays free of services and Vue** (as ADR 0018 wants), so the same drawing serves the editor, the preview and the exports. Making its own scratch canvas is drawing, not a service.

## Where the backend fits

Account, sync, billing and sharing code lives under `services/` (for example `services/api/`), with its types and the wire format in `domain/` (a synced Pattern is the existing Pattern file/encoding, ADR 0009). Anything a person can do offline keeps working through the local implementations (ADR 0001, ADR 0014: the app stays usable without an account).

## Consequences

- Moving the impure code is a small, mechanical change and is done ahead of the backend phase (ticket 207).
- Tests of composables use a fake service instead of stubbing `localStorage`.
- The database choice (`docs/research/database-choice.md`) affects only `services/api` and the server, not the app's other layers.

## Considered options

- Put API code in composables (rejected: makes every composable know about network failure, auth and retries).
- Limit `services/` to the Pattern library, download/share and the API, leaving small preferences with their own `localStorage` helpers (rejected: one rule with no exceptions is easier to keep and to check).
- Move `imageDecode.ts` to `rendering/`, which already uses canvas (rejected: decoding is input, not drawing), or keep it in `domain/` as an exception (rejected: same reason as above).
- A feature-folder layout (`patterns/`, `accounts/`, `billing/`) (rejected for now: the app is one feature, the editor, and role-based folders match how it is already organized; revisit when accounts and billing UI exist).
