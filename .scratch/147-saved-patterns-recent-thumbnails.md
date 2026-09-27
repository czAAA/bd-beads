# 147: Saved Patterns: recent thumbnails, expandable

**What to build:** Saved Patterns becomes the box in the `SavedPatterns` and `SavedPatternsExpanded` cards: the five most recently saved Patterns as round thumbnails with name and size below, the open Pattern ringed in `--accent`, a hover or focus × Remove, and a ↓ expand button. Expanded, it shows every Pattern plus a footer with Export Pattern and Export all. Clicking a thumbnail opens that Pattern. It uses the last-saved order from ticket 145 and the expandable panel from ticket 146.

**Blocked by:** 145, 146

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: SavedPatterns, SavedPatternsExpanded. Names are one line cut with an ellipsis at 58px, the full name in a tooltip (`writing.md`).

- [x] The collapsed body shows the five most recently saved Patterns (104px); expanded shows all, plus the footer with `--line-soft` rule and two 32px secondary buttons
- [x] A thumbnail is a 44px circle on `--elevated` holding the Pattern's own 36px thumbnail, name (at most 58px wide, two lines) and size in meta-tiny
- [x] The open Pattern has the accent ring and accent name; Remove is a 20px round button at the circle's top-right, shown on hover or keyboard focus, and keeps today's remove behavior and confirmation
- [x] Saving a Pattern moves it to the front of the list; the header meta reads "5 of 12"
- [x] Export Pattern and Export all keep working as they do today
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [x] Thumbnail names are one line with an ellipsis and the full name as a tooltip

**Done (ticket 147):** Saved Patterns is built on ticket 146's ExpandablePanel. Each thumbnail is the Pattern itself, sampled to at most 72×72 pixels (thumbnailPixels, turned as it shows on screen, empty beads over the `board` color), so a Pattern of any size costs the same. Names are one line with an ellipsis at 58px, the full name in the Tooltip; the button's accessible name stays the summary ("Fox · 40×30"). The box is expandable whenever it holds a Pattern, since Export Pattern and Export all live only in the expanded footer; "Export all Patterns" is now "Export all" as the card writes it. Remove keeps today's behavior (no confirmation existed), now as the card's neutral × rather than a red button; it shows on hover or keyboard focus, and always where there is no hover.
