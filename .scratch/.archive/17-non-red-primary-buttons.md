# 17: Reserve red for destructive actions only

**What to build:** Buttons app-wide stop defaulting to red. Primary/neutral actions (New Pattern, zoom controls, tool selection, etc.) use a non-red color from the existing anchor palette; red (amaranth) becomes a dedicated "destructive action" style applied explicitly to actions like removing a saved Pattern, rather than being every button's default by accident.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The default button style (`style.css`) no longer uses the red/amaranth anchor color
- [ ] A distinct, explicitly-applied destructive/danger button style exists using the red/amaranth anchor color
- [ ] The "Remove" button in the saved-Patterns list (and any other delete/remove-type action) uses the destructive style
- [ ] Every other existing button (New Pattern, zoom in/out/reset, paint/fill tool selection, undo) renders in the non-red default style
- [ ] Hover/focus/disabled states remain legible against the new default color
