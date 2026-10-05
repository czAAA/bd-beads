# 296: Undo, Redo and the Row progress toggle go in the Zoom pill

**What to build:** Under 1024px the Zoom pill reads: Rulers, Undo, Redo, Row progress toggle, zoom out, the zoom level, zoom in, Fit. Undo and Redo are greyed out when there is nothing to undo or redo. The Progress bar shows only while the toggle is on and gives its height back to the canvas when off; the toggle's state is kept like the Rulers preference. Remove Undo and Redo from the Frame sheet. Update the ZoomPill card in the design system in the same commit (DESIGN.md §6).

**Blocked by:** 295

**Human involvement:** interactive

**Status:** ready-for-agent

- [ ] The pill holds the eight controls in that order, each with an accessible name and Tooltip, at 320px wide without wrapping
- [ ] Undo and Redo work as the hotkeys do, one step per stroke, and are disabled at the ends of history
- [ ] The Progress bar is hidden while the toggle is off and the canvas takes its height; turning it on brings the bar back along the bottom
- [ ] The toggle's state is kept on the device
- [ ] The Row progress lock and "Set Frame to start" behaviour are unchanged
