# 146: Beads needed: expandable panel

**What to build:** Beads needed becomes the box in the `BeadsNeeded` card: a fixed-height summary titled "Beads needed · {total}" showing up to three color rows (swatch, name, count), with a ↓ expand button that grows the box **downward** to show every color, pushing the boxes below it down. Escape or ↑ collapses it. This ticket builds the shared expandable-panel component that Saved Patterns (147) reuses.

**Blocked by:** 141, 157

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: BeadsNeeded. At 24″ and wider it shows 5 rows before expanding (ticket 83).

- [ ] The header is 28px with the title, optional muted suffix, optional right-hand meta, and the 28px round expand button (14px arrow icon)
- [ ] Collapsed, the body is a fixed 96px; expanded, it takes its natural height (never less than collapsed) and the left column scrolls if needed
- [ ] Escape and ↑ collapse it; the expand button has an accessible name and reports its state
- [ ] Rows use a 12px swatch with an inset edge, `--body` names and right-aligned `--ink` counts, with `--line-soft` rules; numbers group thousands with a no-break space
- [ ] The panel is elevation 1 in light and a `--panel` surface step in dark
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [ ] Correct in both the light and the dark theme
- [ ] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [ ] Existing Beads needed content and its tests are unchanged
