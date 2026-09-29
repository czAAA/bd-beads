# 200: Extract Pattern import/import-switch into useImportSwitchFlow

**What to build:** Importing Pattern files — joining the library directly, or the "keep current / save & switch / switch" flow when a Pattern is already open — works exactly as today, but lives in a new `useImportSwitchFlow` composable instead of inline in App.vue, including its toast notification. This does not touch undo history (confirmed by reading the current code: none of these handlers call into it). Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useImportSwitchFlow` owns importing Patterns, the keep-current/save-and-switch/switch decision, and the import toast
- [ ] App.vue no longer declares any of this directly
- [ ] All existing import-switch tests pass against the new composable (moved, not proxied through App.vue)
- [ ] App.vue still boots and all other existing tests pass
