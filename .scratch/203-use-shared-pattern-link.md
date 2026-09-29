# 203: Extract shared-Pattern-via-URL loading into useSharedPatternLink

**What to build:** Opening the app via a shared-Pattern link, and the page-lifecycle hooks that support it (mount, unmount, page-hide), work exactly as today, but live in a new `useSharedPatternLink` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useSharedPatternLink` owns loading a Pattern from a shared URL and the mount/unmount/page-hide lifecycle around it
- [ ] App.vue no longer declares any of this directly
- [ ] Opening a shared-Pattern link still behaves exactly as today
- [ ] App.vue still boots and all other existing tests pass
