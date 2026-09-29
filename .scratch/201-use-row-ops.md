# 201: Extract row-level operations into useRowOps

**What to build:** Rotate, Row progress on/off, Row direction, and moving the Row progress pointer all work exactly as today, but live in a new `useRowOps` composable instead of inline in App.vue. None of these are undo steps today (confirmed by reading the current code and its comments — they're explicitly not grid edits), so this composable has no dependency on undo history. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useRowOps` owns Rotate, Row progress toggle, Row direction toggle, and Move row
- [ ] App.vue no longer declares any of this directly
- [ ] None of these become undo steps (unchanged from today) and Rotate still refits the zoom afterward
- [ ] App.vue still boots and all other existing tests pass
