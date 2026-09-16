# 31: Select tool — copy a rectangular area and stamp it elsewhere

**What to build:** A new "Select" tool alongside Paint and Fill in the tool strip. Dragging on the canvas while Select is active draws a rectangular marquee, grid-aligned the same way a Paint stroke is, staying highlighted once the drag ends; starting a new drag replaces the previous selection, and switching or creating a Pattern clears it. A Copy action, enabled only while a selection exists, snapshots that rectangle's cells into an in-session clipboard (not saved with the Pattern, cleared the same way the undo stack is on a Pattern switch). Once copied, hovering the canvas previews the copied block's real per-cell colors following the cursor, anchored at the hovered cell — extending today's single-color hover preview (ticket 23) into a multi-color one. Clicking stamps the block onto the grid at that position as a single undo step; a stamp reaching past the grid's edge is clipped silently rather than blocked. Empty cells inside the copied block are transparent on paste: they leave whatever's already at the destination alone instead of erasing it, so stamping a motif onto already-painted background doesn't punch holes in it. The clipboard can be stamped repeatedly at different spots until a new Copy, a new selection, or a Pattern switch replaces or clears it. Paste is unaffected by Mirror, the same precedent Fill already sets (see CONTEXT.md's Mirror entry). CONTEXT.md's Language section gains entries for Selection, Copy, and Paste.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A "Select" tool appears in the tool strip alongside Paint and Fill, chosen the same way
- [ ] Dragging on the canvas while Select is active draws a rectangular marquee aligned to grid cells, visible during the drag and after release
- [ ] Starting a new drag replaces the previous selection; only one selection is active at a time
- [ ] Switching the active Pattern, or starting a new Pattern, clears the current selection and clipboard
- [ ] A Copy action is enabled only when a selection exists, and captures the selected rectangle's cells — including which ones are empty — into an in-session clipboard
- [ ] After copying, hovering the canvas shows a live preview of the copied block's actual colors following the cursor, anchored at the hovered cell
- [ ] Clicking the canvas stamps the copied block onto the grid at the hovered position as a single undo step
- [ ] A stamp that would extend past the grid's edge is clipped silently rather than blocked or shifted
- [ ] Empty cells within the copied block leave the destination cell's existing color untouched when stamped, rather than erasing it
- [ ] The clipboard can be stamped repeatedly at different positions until a new Copy, a new selection, or a Pattern switch replaces or clears it
- [ ] Pasting is unaffected by Mirror axes, consistent with Fill
- [ ] CONTEXT.md's Language section documents Selection, Copy, and Paste alongside the app's other domain terms
- [ ] New behavior is covered by tests at the domain layer (copy/paste logic) and component layer (drag-to-select, click-to-stamp)
