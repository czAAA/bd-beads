# 193: Extract tool-invocation-from-cursor into useToolAtCursor

**What to build:** Invoking the active tool at the keyboard cursor's position (including Shift-extend selection from the keyboard) works exactly as today, but lives in a new `useToolAtCursor` composable rather than being fused into the keyboard-navigation code. This composable is deliberately separate from keyboard navigation itself (ADR 0023) so it can later serve other cursor sources (e.g. touch), even though it needs several paint/selection functions injected. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 190 (usePaintStroke)

**Status:** needs-triage

- [ ] `useToolAtCursor` owns invoking the active tool (and Shift-select extension) at a given cursor position
- [ ] App.vue no longer declares this logic directly
- [ ] Using any tool via the keyboard cursor, and Shift-extending a selection via the keyboard, behave exactly as before
- [ ] App.vue still boots and all other existing tests pass
