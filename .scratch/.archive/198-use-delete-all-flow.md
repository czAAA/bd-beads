# 198: Extract Delete all into useDeleteAllFlow

**What to build:** "Delete all" (its confirmation modal and the reset-as-one-undo-step behavior) works exactly as today, but lives in a new `useDeleteAllFlow` composable that commits through `useUndoHistory` (#189) instead of calling `pushHistory` directly from App.vue. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 189 (useUndoHistory)

**Status:** done

- [x] `useDeleteAllFlow` owns the confirm-open state and the confirm/cancel handlers, committing via `useUndoHistory`
- [x] App.vue no longer declares any of this directly
- [x] Delete all still ignores the Row progress lock and lands as a single undo step, exactly as today
- [x] App.vue still boots and all other existing tests pass
