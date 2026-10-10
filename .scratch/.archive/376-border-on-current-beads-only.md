# 376: Row progress rings only the beads in progress, with no line between them

**What to build:** the Row progress marker keeps the beads of the current pass lifted above their neighbours (so no corner covers them) and keeps the ring round each of them, but the 3px line that joined the rings (tickets 352, 369, 375) is gone. Only the focus beads carry a border: a 3px ring in the marker color on each bead's cell edge. Beads still to weave in the line carry nothing.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Every bead of the current pass is still lifted and ringed, on every Technique and in both Row directions
- [x] No line is drawn along the row or column, and no ring on beads outside the pass
- [x] The ring is 3px (was 2px)
- [x] The BeadBoard card, the design system changelog and CONTEXT.md say so
- [ ] The visual baselines for Row progress are updated (a human reviews them)
- [x] The ticket is archived in the same change
