# 06: Area fill tool

**What to build:** A bucket-fill tool that repaints all contiguous same-colored cells connected to the clicked cell with the currently selected Palette color.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Selecting the fill tool and clicking a cell repaints every contiguous cell of the same original color with the selected color
- [ ] Fill respects cell adjacency as defined by the Pattern's grid geometry (including the offset techniques from ticket 04)
- [ ] Fill is undoable as a single action
