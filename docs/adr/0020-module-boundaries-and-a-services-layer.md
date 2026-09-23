# Modules by role, with a services layer for anything that leaves the device

**Status: proposed (ticket 65).** Written from a walk through the code by the agent; the ticket asks for it to be agreed with a person before backend work (tickets 71, 78, 84, 85) builds on it.

## What the code is today

`src/` already separates by role, and the imports mostly run one way:

- `domain/` — Pattern, grid geometry, palette, beads, history, selection, conversion, file and QR encodings. Plain TypeScript, no Vue, no DOM. (Two exceptions do touch the browser and are really services: `patternStorage.ts` reads and writes `localStorage`, `fileDownload.ts` triggers a download.)
- `rendering/` — the Pattern renderer, overlay, sprites, and (ticket 73/74) the PNG/PDF export drawing. Depends on `domain/`, draws on a canvas context it is handed.
- `composables/` — state and gestures that need Vue's reactivity (`usePatternLibrary`, `usePatternZoom`, `useSelectionGesture`, `useQrExport`, …). Depend on `domain/`.
- `components/` — presentation; `App.vue` wires composables to components and still holds a good deal of orchestration (saving, exporting, importing).
- `i18n/` — translations.

## Decision

Keep that layering, make it a rule, and add one layer:

1. **`domain/` is pure.** No Vue, no `window`, `localStorage`, `fetch` or `document`. `patternStorage.ts` and `fileDownload.ts` move out (below).
2. **`services/`** is new, and is the only place that talks to something outside the page's own memory: the local library store (today's `localStorage`), file download and share, and, in the backend phase, the API (accounts, sync, billing, hosted links). Each service is a small interface with a browser/local implementation and, later, a remote one, so the app can be built and tested against the local one and the backend phase swaps or adds implementations rather than rewriting callers.
3. **`composables/` call services and domain, never `fetch` directly.** `usePatternLibrary` is the seam the sync work extends: it keeps the Pattern library in memory and persists through a library-store service.
4. **`components/` never import services.** They emit events; `App.vue` and composables act. `App.vue`'s orchestration (`onSave`, the exports, imports) moves into composables as it is touched, so it stops growing.
5. **`rendering/` stays free of services and Vue** (as ADR 0018 wants), so the same drawing serves the editor, the preview and the exports.

## Where the backend fits

Account, sync, billing and sharing code lives under `services/` (for example `services/api/`), with its types and the wire format in `domain/` (a synced Pattern is the existing Pattern file/encoding, ADR 0009). Anything a person can do offline keeps working through the local implementations (ADR 0001, ADR 0014: the app stays usable without an account).

## Consequences

- Moving the two impure files is a small, mechanical change and can be done ahead of the backend phase.
- Tests of composables use a fake service instead of stubbing `localStorage`.
- The database choice (`docs/research/database-choice.md`) affects only `services/api` and the server, not the app's other layers.

## Considered options

- Put API code in composables (rejected: makes every composable know about network failure, auth and retries).
- A feature-folder layout (`patterns/`, `accounts/`, `billing/`) (rejected for now: the app is one feature, the editor, and role-based folders match how it is already organized; revisit when accounts and billing UI exist).
