# 369: The light theme's marker is royal blue, and the Row progress marker is one continuous border

**What to build:** ticket 352 made the light `marker` the accent orange (`#fa520f`), which is only about 3:1 on the light canvas backgrounds, so the current row's ruler number was hard to read. The light `marker` becomes royal blue `#1d4ed8` (6.0:1 or more on all five light backgrounds). It stays the one color of the Row progress border, the Selection, the Mirror axes and the current row's ruler number. Dark and high contrast do not change.

The marker is also drawn as one continuous border, not a separate edge per bead: on peyote and brick stitch, where the beads' edges are not in line, it steps along the seam between two beads, and on peyote the beads of the line still to weave carry it on their near edge, so it traces the boundary between what is woven and what is not. It is one stroked line with rounded turns; along a peyote row it follows the bottom outline of the row's rounded beads.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Light `marker` is `#1d4ed8` in `tokens.json`, both `tokens.css` files and `LIGHT_THEME`
- [x] The canvas background contrast test asks 4.5:1 for the light marker again
- [x] The design system (accessibility, BeadBoard, CanvasBackground cards, changelog) says the new color
- [x] The visual baselines that show the light marker are updated
- [x] The marker is one continuous, stepped border on peyote and brick stitch, in both Row directions
- [x] The ticket is archived in the same change
