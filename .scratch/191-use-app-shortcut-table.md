# 191: Extract the app's keyboard-shortcut table into useAppShortcutTable

**What to build:** The app's keyboard shortcuts (Undo, Redo, Escape, tool keys, etc.) still fire exactly as today, but the guard predicates (is this the undo shortcut, is a modal open, is focus on a toolbox button, ...) and the table construction that feeds the existing generic `useKeyboardShortcuts` composable move into a new `useAppShortcutTable` composable. `useKeyboardShortcuts` itself is generic and does not change. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 189 (useUndoHistory), 190 (usePaintStroke) — its table entries call into their handlers

**Status:** done

- [x] `useAppShortcutTable` builds the shortcut table (predicates + entries) and is the only thing that calls the generic `useKeyboardShortcuts`
- [x] App.vue no longer builds the shortcut table or declares the guard predicates directly
- [x] Every existing keyboard shortcut still works exactly as before (covered by existing keyboard tests, moved to target the new composable)
- [x] App.vue still boots and all other existing tests pass

## Resolution

**What changed:** The shortcut guard predicates (undo/redo chords, plain keys, modal-open, focused-toolbox-button) and the shortcut table moved from App.vue into the new `useAppShortcutTable`, the only caller of `useKeyboardShortcuts`. App.vue passes it lazy state accessors and handlers.

**Files:** `src/composables/useAppShortcutTable.ts` (new), `src/composables/useAppShortcutTable.test.ts` (new), `src/App.vue`.

**Decisions:** Open dialogs collapse into one `anyDialogOpen` dep; `hasOpenLayer` is passed in. `App.keyboard.test.ts` stays as the end-to-end check.
