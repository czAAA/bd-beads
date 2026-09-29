# 195: Extract Save behavior into useSaveFlow

**What to build:** Saving the current Pattern, and the "saved" confirmation that follows, work exactly as today, but live in a new `useSaveFlow` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useSaveFlow` owns the save action and the saved-confirmation state/timeout
- [ ] App.vue no longer declares any of this directly
- [ ] Save behavior, including the confirmation, is unchanged
- [ ] App.vue still boots and all other existing tests pass
