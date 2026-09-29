# 206: Extract the app shell and its CSS out of App.vue

**What to build:** App.vue reaches its ~100-150 line target (ADR 0023): the page-shell markup and whatever scoped CSS has no single owning component are extracted, leaving App.vue as pure composition — template layout plus composable wiring, with no inline business logic. This is the last ticket in the decomposition: everything else must already be out.

**Blocked by:** 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205 (every other extraction in ADR 0023)

**Status:** needs-triage

- [ ] App.vue is reduced to roughly 100-150 lines: template composition and top-level composable wiring only
- [ ] The app shell's own layout markup and its CSS (the styles with no single child-component owner) are extracted; CSS for markup already moved to a component in an earlier ticket has already gone with it, not left behind here
- [ ] The full app still renders, boots, and behaves identically on desktop and phone layouts
- [ ] The full existing test suite passes against the new structure
