# 375: The beads in progress stand out, ringed and lifted, joined by one border line

**What to build:** the Row progress marker now shows the beads of the current pass, not just a line beside them. Each bead woven in the current pass (the whole row or column on loom and brick stitch; on peyote's later lines only the half that pass adds) is drawn again above its neighbours, so a peyote or brick bead's corners are no longer covered by the next row while it is current. It keeps the 10% brightness. A thin 2px ring in the marker color goes round each of them, on the edge of its cell, and the 3px marker line joins the rings: the line steps across along the edge of the bead in the pass, where the ring turns, so the line and the rings share their corners and read as one border.

Finished rows are also dimmed 10 points more: a finished bead shows its own color at 50% over the board (it was 60%), in light and dark.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Every bead of the current pass is lifted above the cells layer and ringed in the marker color, on every Technique and in both Row directions
- [x] Only the beads woven in the pass are ringed, so on peyote's later lines half the line is
- [x] The marker line steps along the ring's edge, so the line and the ring share corners (no double corners)
- [x] Finished rows show 50% of their own color (was 60%), light and dark
- [x] The BeadBoard card and the design system changelog say so
- [x] The visual baselines for Row progress are updated
- [x] The ticket is archived in the same change
