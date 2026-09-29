# 199: Extract Resize/Change size (and Remove selected row/column) into useChangeSizeFlow

**What to build:** Resize, the Change size modal, and "remove selected row/column" all work exactly as today, but live in a new `useChangeSizeFlow` composable that commits through `useUndoHistory` (#189) instead of calling `pushHistory` directly from App.vue. These three share one commit path (`commitSizeChange`) today, so they move together as one unit rather than being split across separate tickets. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 189 (useUndoHistory)

**Status:** needs-triage

- [ ] `useChangeSizeFlow` owns the Change size modal's open state, Resize, "remove selected row/column", and their shared undo-committing logic, committing via `useUndoHistory`
- [ ] App.vue no longer declares any of this directly
- [ ] Resize, Change size, and Remove-selected-line still each land as one undo step, the Row progress lock still refuses them the same way, and Mirror axis counts/Selection still reset the same way on a size change
- [ ] App.vue still boots and all other existing tests pass (including existing Change size tests, moved to target the new composable)
