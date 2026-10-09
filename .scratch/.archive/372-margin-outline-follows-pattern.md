# 372: The Frame margin's outline hugs the pattern on peyote and brick stitch

**What to build:** the dashed outline round the Frame margin hung well below the pattern on peyote. It was drawn `rows * CELL_SIZE_PX` tall, but peyote rows nest at three quarters of a bead (and brick stitch rows sit a seam apart), and its width left out the half bead that shifted rows add. The outline now takes its size from `projectExtentPx`, the same as the drawn Project.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The outline's height follows the technique's row pitch (peyote, brick stitch, loom)
- [x] The outline's width includes the half bead of peyote and brick stitch
- [x] Tests pin the outline's size for loom, peyote and brick stitch
- [x] The ticket is archived in the same change
