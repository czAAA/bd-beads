# 205: Extract Replace Bead into useReplaceBeadFlow

**What to build:** Replace Bead (ADR 0017) — picking a Bead from the Replace-Bead select, confirming the swap as a single undo step — works exactly as today, but lives in a new `useReplaceBeadFlow` composable that commits through `useUndoHistory` (#189) instead of calling `pushHistory` directly from App.vue. This cluster was missed in the original decomposition pass and is added here to keep it out of App.vue like everything else in ADR 0023.

**Blocked by:** 189 (useUndoHistory)

**Status:** needs-triage

- [ ] `useReplaceBeadFlow` owns the pending pick, the confirm/cancel handlers, and the select-reset workaround (ticket 113), committing via `useUndoHistory`
- [ ] App.vue no longer declares any of this directly
- [ ] Replace Bead still lands as a single undo step that leaves the grid, Row progress, and Mirror untouched
- [ ] App.vue still boots and all other existing tests pass
