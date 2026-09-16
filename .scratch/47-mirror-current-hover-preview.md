# 47: Mirror current hover preview

**What to build:** Hovering a "Mirror current" button previews what clicking it would do: that direction's axes are drawn on the canvas (a single center axis if its count is 0), and the cells the click would overwrite are dimmed. Moving off the button removes the preview.

Part of the rich mirror feature (flag introduced in ticket 44): with `VITE_RICH_MIRROR` off, hovering Mirror current shows no preview, as today.

**Blocked by:** 44, 46

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- The preview always shows at least one axis, matching the count-0 fallback of ticket 46.
- Dimmed cells are exactly the ones the click would change; the source strip and cells that would stay the same are not dimmed.
- Uses the same thin axis line style as ticket 44.

- [ ] Hovering shows that direction's axes, including a center axis when its count is 0
- [ ] Cells the click would overwrite are dimmed; nothing else is
- [ ] Leaving the button clears axes (other than those shown by a count above 0) and dimming
- [ ] Clicking produces exactly the change the preview showed
- [ ] With the rich mirror flag off, hovering shows no axes and no dimming
