# 189: Extract undo/redo history into useUndoHistory

**What to build:** Undo and redo work exactly as they do today, but the history state and the logic that commits, applies, and steps through it live in a new `useUndoHistory` composable instead of directly in App.vue. Wraps the existing pure `domain/history.ts`; that module doesn't change. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] `useUndoHistory` owns the history state, `commitGridChange`, `applyHistoryStep`, `onUndo`, `onRedo`
- [ ] App.vue no longer declares any of the above directly; it calls into the composable
- [ ] Undo/redo behavior is unchanged: existing undo/redo tests pass against the new composable (moved, not just left pointing at App.vue)
- [ ] App.vue still boots and all other existing tests pass

## Resolution

**What changed:** Undo/redo history state, `commitGridChange`, `applyHistoryStep`, `onUndo`, `onRedo` (and `currentUndoEntry`) moved from App.vue into the new `useUndoHistory` composable, which wraps `domain/history.ts` (unchanged). App.vue now destructures `canUndo`, `canRedo`, `record` (as `recordHistory`), `reset` (as `resetHistory`), `commitGridChange`, `onUndo`, `onRedo`. Undo/redo behaviour is unchanged.

**Files:** `src/composables/useUndoHistory.ts` (new), `src/composables/useUndoHistory.test.ts` (new), `src/App.vue`.

**Decisions:**
- The composable takes lazy dependency accessors (current Pattern, `replacePattern`, Mirror axis counts/restore, and a `clearSelectionAndHover` callback). That lets `useUndoHistory` and `useMirrorState` reference each other (Mirror needs `commitGridChange`; history needs Mirror's counts) without ordering problems.
- Other commands' direct `pushHistory` calls became `recordHistory(entry)`; the template's `canUndo(history)` became the `canUndo`/`canRedo` computeds.
- Added a `record`/`reset` API rather than exposing the raw `history` ref.

**Left out:** The existing undo/redo tests in the `App.*.test.ts` files were not moved; they exercise undo through the UI and still pass. Composable-level tests were added for commit, undo, redo, no-op commit, no open Pattern, size-changing step and reset. Full suite (1889 tests) and `vue-tsc` pass.
