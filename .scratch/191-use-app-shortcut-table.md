# 191: Extract the app's keyboard-shortcut table into useAppShortcutTable

**What to build:** The app's keyboard shortcuts (Undo, Redo, Escape, tool keys, etc.) still fire exactly as today, but the guard predicates (is this the undo shortcut, is a modal open, is focus on a toolbox button, ...) and the table construction that feeds the existing generic `useKeyboardShortcuts` composable move into a new `useAppShortcutTable` composable. `useKeyboardShortcuts` itself is generic and does not change. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 189 (useUndoHistory), 190 (usePaintStroke) — its table entries call into their handlers

**Status:** needs-triage

- [ ] `useAppShortcutTable` builds the shortcut table (predicates + entries) and is the only thing that calls the generic `useKeyboardShortcuts`
- [ ] App.vue no longer builds the shortcut table or declares the guard predicates directly
- [ ] Every existing keyboard shortcut still works exactly as before (covered by existing keyboard tests, moved to target the new composable)
- [ ] App.vue still boots and all other existing tests pass
