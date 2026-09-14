# 05: Manual cell painting with undo

**What to build:** User picks a color from the Palette and clicks grid cells to paint them; a separate undo action reverts the most recent painting action.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] User can pick a color from the Palette
- [ ] Clicking a cell paints it with the selected color, regardless of the Pattern's Technique/grid geometry
- [ ] Undo reverts the most recent cell-paint action; repeated undo steps back further
- [ ] Painted state persists to localStorage like the rest of the Pattern
