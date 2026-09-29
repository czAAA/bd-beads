# 194: Extract keyboard grid navigation into useKeyboardCursor

**What to build:** Keyboard navigation over the grid (arrow keys, rotation-aware remapping, keeping the cursor scrolled into view, focus handling) works exactly as today, but lives in a new `useKeyboardCursor` composable — the largest inline cluster in App.vue, now isolated. Part of the App.vue decomposition in ADR 0023.

**Blocked by:** 192 (useA11yAnnouncer), 193 (useToolAtCursor)

**Status:** done

- [x] `useKeyboardCursor` owns the cursor position, focus/scroll-into-view handling, and the keydown/keyup handlers for grid navigation, calling into `useA11yAnnouncer` and `useToolAtCursor`
- [x] App.vue no longer declares any of this directly
- [x] All existing keyboard-navigation tests pass against the new composable (moved, not proxied through App.vue)
- [x] App.vue still boots and all other existing tests pass
