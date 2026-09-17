# 35: Move New Pattern into Saved Patterns, zoom controls onto the canvas corner

**What to build:** Two controls leave the row above the canvas.

- **New Pattern** moves into the below-canvas Saved Patterns box (ticket 39's three-box row), as the first thing in that box, above the list of saved Patterns. It works as it does today — opens the New Pattern form, which still renders in the main panel per ADR 0004 — and keeps the app's non-red button style.
- **Zoom controls** become a compact cluster fixed to the canvas box's top-right corner, styled like a window's own controls (small buttons in a row: −, level, +, reset), with a slightly translucent background so painted cells underneath aren't fully hidden. The cluster stays in place while the pattern is scrolled, zoomed or rotated. Pointer activity on it never reaches the grid: clicking or dragging on it doesn't paint, erase or select, and hovering it shows no paint preview. It stays readable and clickable at every zoom level, even when the pattern runs underneath it.

With both controls gone, the above-canvas panel holds only the tool strip (ticket 40); no empty row is left where they used to be.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- Supersedes this ticket's original plan (New Pattern in the header, zoom as a right-edge vertical stack, decided 2026-09-16) — this text replaces it in place rather than shipping both.
- New Pattern goes inside the Saved Patterns box, not the header's aqua box — kept close to the list it creates entries for.
- Zoom is a corner cluster, not a full-edge stack, deliberately modeled on OS window chrome (compact, top-right corner, all controls in a row).
- The New Pattern *form* itself is unaffected: still renders in the main panel per ADR 0004. Only the button that opens it moves.
- ADR 0004 and ADR 0005 carry amendment notes for the new placement (written alongside this ticket).

- [ ] New Pattern renders as the first control in the Saved Patterns box and no longer appears above the canvas
- [ ] New Pattern still opens the New Pattern form in the main panel, and is still disabled while no Patterns are saved
- [ ] The zoom controls render as a compact cluster (−, level, +, reset) fixed to the canvas box's top-right corner, only while a Pattern is open, and no longer appear above the canvas
- [ ] The zoom cluster has a translucent background and stays in the same spot while the pattern is scrolled, zoomed or rotated
- [ ] Clicking, dragging or hovering over the zoom cluster never paints, erases, selects or shows a hover preview on the cells beneath it
- [ ] The canvas box still fits the Pattern snugly and shows its border on all four sides at every zoom level
- [ ] With both controls moved, the above-canvas panel shows only the tool strip, with no empty row above it
- [ ] Tooltips and aria-labels on the zoom buttons are unchanged in both languages
- [ ] ADR 0004 and ADR 0005 amendment notes are present
