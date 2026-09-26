# 167: Responsive: iPad 13″ tier and the breakpoint setup

**What to build:** The first tier below the reference layout, and the breakpoint setup every other tier uses (`responsive.md`, 1024–1279px): the left column stays docked at 300px (286px boxes) with 16px page padding and 12px between boxes, Beads needed and Saved Patterns start collapsed, Import a file and Import QR code become icon buttons with tooltips, and Keyboard shortcuts shows only when a keyboard or trackpad is attached.

**Blocked by:** 166

**Status:** ready-for-agent

- [ ] The breakpoints from the design system's layout tokens are in place and shared (media queries use their literal values)
- [ ] At 1024, 1133 and 1180px wide the layout matches the tier description and the ScreenSizes card
- [ ] Type and control sizes are unchanged; only spacing, column width and labels change
- [ ] The drawing surface resizes once the layout settles, never per frame (ADR 0018); ticket 103's check passes
