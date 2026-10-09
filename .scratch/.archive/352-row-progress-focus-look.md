# 352: Row progress focus is a single thicker edge, finished rows dim instead of grey and return on hover, and the current row is brighter

**What to build:** three changes to how Row progress looks on the canvas, delivered together as one look for the current row and the finished rows.

1. **Current-row marker.** Today the marker outlines the current row (or column) on all sides. It becomes a single border, a bit thicker than today's, on the one edge facing the next row to weave (the direction of completion). The edge follows Row direction: the bottom edge when weaving top to bottom, the top edge bottom to top, and the matching side edge when rows run down the columns. On peyote and brick stitch it still follows the half-bead shift of the row.
2. **Finished rows.** They are no longer greyed out. Every finished bead keeps its own colour and is only slightly dimmed, in the light and the dark theme alike. While the pointer is hovering over the canvas, all finished rows draw at normal colour; when it leaves they dim again. Hover counts for a mouse and for an Apple Pencil hovering over the screen. A click or tap on a finished row also toggles all finished rows between normal and dimmed, so a finger-only phone can do it too; that toggle holds until it is toggled again (it is a view setting, not saved with the Project, and not an Undo step). Finished rows are locked, so the tap never draws. The finished-row lock is unchanged.
3. **Current row brightness.** The beads of the current row or column are always drawn 10% brighter than the todo rows, which stay unchanged. It holds for every technique, both Row directions, and while finished rows are dimmed or restored by hover.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The marker is one border on the edge facing the next row to weave, thicker than the current outline, for both Row directions and both pointer directions (top to bottom / bottom to top, left to right / right to left)
- [ ] Peyote and brick stitch markers still follow each row's half-bead shift; loom is unchanged apart from the single edge
- [ ] Finished beads keep their colour at a reduced opacity in both themes, with no greyscale
- [ ] Hovering the canvas with a mouse or an Apple Pencil draws every finished row at normal colour; leaving it dims them again
- [ ] Tapping or clicking a finished row toggles every finished row between normal and dimmed, on a touch-only phone as well; it draws nothing, is not an Undo step and is not saved with the Project
- [ ] Hover and the toggle work together: dimmed by default, hover shows normal while it lasts, the toggle keeps normal until toggled back
- [ ] The current row's beads are 10% brighter than the todo rows in both themes
- [ ] The finished-row lock still blocks Paint, Erase, Fill, Paste and Mirror
- [ ] The design system (tokens, the marker and finished-row specs, `bundle.css`, `design-values.css`, README changelog) and `CONTEXT.md`'s Row progress entry say the new look
- [ ] Unit tests cover the dimming, the hover restore and the brightening; the visual baselines are updated
