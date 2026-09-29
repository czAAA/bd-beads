# 202: Extract PNG/PDF/QR export wiring into useExportFlow

**What to build:** Exporting a Pattern as a file, PNG, PDF, or QR code (including the maker's-name-on-export flow) works exactly as today, but lives in a new `useExportFlow` composable that builds on the existing `useQrExport` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useExportFlow` owns the maker's-name step and running each export (file, PNG, PDF), calling the existing `useQrExport` for QR
- [ ] App.vue no longer declares any of this directly
- [ ] All existing export tests pass against the new composable (moved, not proxied through App.vue)
- [ ] App.vue still boots and all other existing tests pass
