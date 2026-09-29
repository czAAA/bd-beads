# 204: Extract remaining overlay open/close state into useOverlayVisibility

**What to build:** The remaining UI-shell overlays — the drawer, the theme sheet, the phone new-Pattern sheet, and the phone saved-Patterns sheet — open and close exactly as today, but their state lives in a new, small `useOverlayVisibility` composable instead of loose booleans in App.vue. The Shortcuts-help modal's boolean is intentionally left inline in App.vue (single boolean, no logic — not worth extracting). Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `useOverlayVisibility` owns drawer/theme-sheet/phone-new-Pattern-sheet/phone-saved-Patterns-sheet open state and their handlers
- [x] App.vue no longer declares any of this directly (except the Shortcuts-help boolean, left as-is)
- [x] Every overlay still opens/closes exactly as today, on both desktop and phone layouts
- [x] App.vue still boots and all other existing tests pass
