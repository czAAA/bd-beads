# 189: Extract undo/redo history into useUndoHistory

**What to build:** Undo and redo work exactly as they do today, but the history state and the logic that commits, applies, and steps through it live in a new `useUndoHistory` composable instead of directly in App.vue. Wraps the existing pure `domain/history.ts`; that module doesn't change. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useUndoHistory` owns the history state, `commitGridChange`, `applyHistoryStep`, `onUndo`, `onRedo`
- [ ] App.vue no longer declares any of the above directly; it calls into the composable
- [ ] Undo/redo behavior is unchanged: existing undo/redo tests pass against the new composable (moved, not just left pointing at App.vue)
- [ ] App.vue still boots and all other existing tests pass
