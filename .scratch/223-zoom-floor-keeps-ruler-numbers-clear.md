# 223: Zoom-out floor keeps every ruler number clear

**What to build:** Zooming out and Fit stop at the design system's smallest bead, so every ruler number stays readable: 16px beads at the phone tier (below 744px), 15px at every wider tier (the `bead-min-*` tokens). Today the floor is 50%, a 10px bead with numbers scaled to about 6px. A Pattern too wide for the box at that floor is panned, not shrunk further. The floor holds for Patterns up to 999 columns, because column numbers from 100 are turned (ticket 222).

**Blocked by:** 222

**Status:** ready-for-agent

- [ ] Zoom-out and Fit never draw a bead smaller than the tier's minimum, and the zoom control shows the real percentage at that floor
- [ ] The floor follows the tier, including when the window is resized or a phone is rotated
- [ ] A Pattern wider or taller than the box at the floor is panned; nothing is clipped and the rulers still match the beads
- [ ] At the floor, no two ruler numbers touch, for a 999-column Pattern in each theme
- [ ] Existing zoom keyboard shortcuts and the ZoomPill still work and stop at the floor
- [ ] Uses the design system `bead-min-*` tokens, not hardcoded sizes
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no, not added to the Overview or the Tour
