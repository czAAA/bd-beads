# 192: Extract screen-reader announcements into useA11yAnnouncer

**What to build:** Screen-reader announcements (cursor position, color under the cursor) work exactly as today, but live in a new `useA11yAnnouncer` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `useA11yAnnouncer` owns the announcement state and `announce`/`announceCursor`/`colorWords`
- [ ] App.vue no longer declares any of the above directly
- [ ] Announcements are unchanged, verified with a screen reader or existing a11y tests
- [ ] App.vue still boots and all other existing tests pass
