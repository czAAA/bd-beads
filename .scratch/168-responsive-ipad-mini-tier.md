# 168: Responsive: iPad mini tier

**What to build:** The iPad mini tier (`responsive.md`, 744–1023px): the header keeps Tools, the mark, the Pattern name, the Bead pill, Replace bead, New Pattern and a More menu (Import a file, Import QR code, language, theme, name on exports). The left column leaves the page and opens from Tools as a 326px drawer over the canvas with a scrim, holding everything the desktop column holds. A bottom toolbar keeps the four tools, the color, Undo and Redo under the thumb, and the Selection context bar appears above the Progress bar.

**Blocked by:** 167

**Status:** ready-for-agent

- [ ] Matches the Drawer, BottomToolbar, OverflowMenu and ContextBar cards at 744, 820 and 834px wide
- [ ] Every desktop feature is reachable; drawing never needs the drawer
- [ ] The drawer traps focus, closes on Escape, the scrim and Tools, and slides with `transform` so the canvas doesn't resize
- [ ] The context bar drops labels right to left when Russian doesn't fit
- [ ] Import results arrive as a toast above the bottom toolbar
- [ ] Correct in the light, dark and high contrast themes
- [ ] Ticket 103's check passes at this size
