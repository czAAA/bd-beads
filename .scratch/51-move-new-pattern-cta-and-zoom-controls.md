# 51: Move New Pattern into Saved Patterns, zoom controls onto the canvas's top-right corner

**What to build:** Two controls that ticket 35 already placed move again.

- **New Pattern** moves out of the top bar's aqua summary box (`app-shell__topbar-summary`) into the below-canvas Saved Patterns box, as the first thing in that box, above the list of saved Patterns. It still opens the New Pattern form (rendered in the main panel, unchanged), still disables while there are no saved Patterns, and keeps the app's non-red button style. With New Pattern gone, the aqua summary box holds just the current-pattern summary group and the language switcher.
- **Zoom controls** move from the floating vertical stack centered on the canvas box's right edge to a compact horizontal cluster fixed to its top-right corner, in the same order as today (+, level, −, reset) but laid out in a row instead of a column, with a slightly translucent background so painted cells underneath aren't fully hidden. It keeps today's approach to staying out of the grid's way — painting on top of the canvas via DOM order rather than an explicit `pointer-events` rule — just repositioned and reflowed.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- This is a fresh ticket, not a revision of ticket 35 — ticket 35 already shipped and stays archived as the historical record of what it built (New Pattern in the top bar, zoom as a right-edge stack). This ticket moves both further.
- New Pattern goes inside the Saved Patterns box, not staying in the top bar — kept close to the list it creates entries for.
- Zoom is a corner cluster, not the current right-edge stack, deliberately modeled on OS window chrome (compact, top-right corner, all controls in a row).
- The New Pattern *form* itself is unaffected: still renders in the main panel per ADR 0004.
- ADR 0004 and ADR 0005 carry new amendment notes for this further move (written alongside this ticket, appended after the existing ticket-35 and ticket-40 amendments).

- [ ] New Pattern renders as the first control in the Saved Patterns box and no longer appears in the top bar
- [ ] The aqua summary box still shows the current-pattern summary and language switcher, now without New Pattern, and doesn't leave an awkward gap where it used to sit
- [ ] New Pattern still opens the New Pattern form in the main panel, and is still disabled while no Patterns are saved
- [ ] The zoom controls render as a compact horizontal cluster (+, level, −, reset) fixed to the canvas box's top-right corner, only while a Pattern is open, and no longer appear along its right edge
- [ ] The zoom cluster has a translucent background and stays in the same spot while the pattern is scrolled, zoomed or rotated
- [ ] Clicking, dragging or hovering over the zoom cluster still never paints, erases, selects or shows a hover preview on the cells beneath it
- [ ] The canvas box still fits the Pattern snugly and shows its border on all four sides at every zoom level
- [ ] Tooltips and aria-labels on the zoom buttons are unchanged in both languages
- [ ] ADR 0004 and ADR 0005 amendment notes for this move are present
