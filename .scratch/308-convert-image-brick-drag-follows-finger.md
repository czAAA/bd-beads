# 308: Dragging a brick-stitch picture vertically follows the pointer exactly

**What to build:** In Convert image, `mmPerScreenPx.y` (`ConvertImageFrame.vue` ~line 288) converts a vertical drag to millimetres as `bead.heightMm / (CELL_SIZE_PX * fitScale)`, and its comment claims the ratio is the same for every Technique. But the preview is drawn by the Project renderer, whose brick-stitch rows sit `rowPitchPx` apart (21px), not `CELL_SIZE_PX` (20px), so a vertical drag on a brick Project moves the picture about 5% faster than the pointer. Take the vertical screen-to-mm ratio from the same row pitch the renderer draws (`rowPitchPx` for the Technique), so the point under the pointer stays under it for every Technique. Only the drag ratio changes. Which row height Convert image uses to sample the picture (`grid.rowHeightPx` versus `rowPitchPx`, ADR 0010) is a separate decision for candidate A3 (Surface view) and is out of scope here. Found in the architecture review (bug 4).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A failing test first drags vertically by N screen pixels on a brick Project and checks that the picture moved by exactly the millimetres those pixels show on screen; it passes after the fix
- [ ] The same test passes for loom and peyote (no change for them if their pitch equals `CELL_SIZE_PX`)
- [ ] The comment above `mmPerScreenPx` states the real rule
- [ ] What Create makes from a resting frame is unchanged (existing conversion tests pass)
