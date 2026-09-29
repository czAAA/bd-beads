# App.vue splits into composables along these boundaries, in this order

**Status: accepted.** Reached by grilling before cutting tickets; continues the direction set in ADR 0020 ("App.vue's orchestration... moves into composables as it is touched, so it stops growing").

## Context

`App.vue` is 3008 lines. Presentational extraction is already far along (45 child components, 29 composables), so the remaining bulk is event-handler wiring and a handful of large inline logic clusters: undo/redo history, paint-stroke lifecycle, keyboard-driven grid cursor navigation, screen-reader announcements, tool-invocation-from-cursor, and the app's keyboard-shortcut table. The goal is a ~100-150 line `App.vue` left as pure composition (template + composable wiring), reached incrementally — each ticket extracts one unit and wires it back in immediately, so the branch stays green throughout.

## Decision

Split along these boundaries, extracted in this dependency order:

1. `useUndoHistory` — history state, `commitGridChange`, `applyHistoryStep`, `onUndo`/`onRedo` (wraps the existing pure `domain/history.ts`).
2. `usePaintStroke` — stroke lifecycle (`beginStroke`/`endStroke`/`paintStrokeCell`/`beginOrCommitPress`). Depends on #1's `commitGridChange`.
3. `useAppShortcutTable` — the app-specific predicates (`isUndoShortcut`, `isPlainKey`, `noModalOpen`, etc.) and the `keyboardShortcuts` table construction that feeds the existing generic `useKeyboardShortcuts`. Depends on #1/#2's handlers as table entries.
4. `useA11yAnnouncer` — announcement state and `announce`/`announceCursor`/`colorWords`. Independent.
5. `useToolAtCursor` — invoking a tool from a cursor position, bridging into paint/selection. Depends on #2 and the existing selection composable.
6. `useKeyboardCursor` — core grid keyboard navigation (cursor position, focus, scroll-into-view, rotation-aware remapping). Depends on #4 and #5.
7. Remaining smaller concerns (save, new-pattern/convert-image creation, zoom/canvas sizing, modal/drawer visibility, delete-all, resize, import-switch, row ops, export, shared-pattern-via-URL) sized individually as tickets.
8. App shell layout and its ~695 lines of scoped CSS extracted last, once everything else has moved out; CSS for markup that moves to a component moves with it, in the same ticket as that extraction.

Two boundary calls worth recording because the obvious alternative was rejected:

- **`useToolAtCursor` is its own composable, not fused into `useKeyboardCursor`.** It isn't self-contained — it needs ~5 external functions injected — but it's conceptually reusable beyond keyboard input (e.g. a future touch or voice cursor), and SRP was prioritized over minimizing parameter counts.
- **The shortcut-table glue is a new composable, not folded into `useKeyboardShortcuts.ts`.** That file is a generic, reusable table-driven registry; the app-specific predicates and table construction are ~40 lines of real logic that would pollute a generic mechanism if merged in.

## Consequences

- Tickets that depend on an earlier, unlanded ticket in this chain get `needs-triage` with an explicit "Blocked by" line, not `ready-for-agent` — this repo's triage labels have no "blocked" state.
- Existing tests (`App.keyboard.test.ts`, `App.export.test.ts`, etc.) move with the logic they cover rather than being preserved 1:1; the target is 80% overall coverage, not parity with today's suite.
- Already-extracted components/composables are out of scope for this pass, even where their naming or boundaries could be improved — touching working, already-extracted code isn't what's making `App.vue` too big.

## Considered options

- One ticket per cohesive slice (component + composable + tests bundled) instead of one ticket per extracted unit — rejected: bigger tickets cost more tokens per implementation session, against the stated token-efficiency goal.
- Reorganizing `composables/`/`components/` into domain subfolders as part of this pass — rejected: it's a separate, debatable decision on its own merits and isn't needed to shrink `App.vue`.

## Outcome (ticket 206)

`App.vue` ended at about 15 lines rather than 100-150, because the wiring moved out of it too. The composition root is `composables/useAppShell.ts`: it instantiates every composable above and hands them over as one flat, typed context (`provideAppShell` / `useAppShell`). `App.vue` calls `provideAppShell()` and renders `AppShell.vue`, which composes `AppHeader`, `AppSidebar`, `CanvasPanel`, `AppBottomBar`, `PhoneSheets` and `AppDialogs`. Each of those draws on the context and carries the scoped CSS of the markup it owns; `AppShell.vue` keeps the page layout and the CSS with no single owner. The context type is the wiring's own return type, so a component can't ask for something the wiring doesn't provide.

Three more composables came out of what was left inline: `useToolAndColor`, `useCanvasPointer` and `usePatternLabels`. `useOverlayVisibility` also owns the phone tier's Tool-sheet routing (`openPhoneSheet`), which the phone-sheet handlers share with the Saved Patterns sheet.
