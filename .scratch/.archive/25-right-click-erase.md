# 25: Right-click erase, mapped to the active tool

**What to build:** Right-clicking the canvas erases instead of paints, using whichever tool is currently selected to decide the erase "grain": under Paint, single-cell (or drag-to-erase-line) erase; under Fill, flood-erase the whole connected same-color region in one click.

**Blocked by:** 22 (erase under Paint should respect live mirror, same as painting)

**Status:** ready-for-agent

- [ ] Right-clicking a cell with the Paint tool active erases that single cell (sets it to no color)
- [ ] Right-click-and-drag with the Paint tool erases every cell along the dragged path, same as left-click-drag paints (per ticket 24)
- [ ] Right-clicking a cell with the Fill tool active erases the entire connected same-color region containing that cell (flood-erase), in one click
- [ ] The browser's native context menu no longer appears when right-clicking the canvas
- [ ] Right-click erase respects mirror mode the same way painting does — erasing also erases the mirrored counterpart cell(s) when a mirror axis is on and Paint is the active tool
- [ ] Each right-click erase action (single cell, dragged line, or flood) is undoable as one step
