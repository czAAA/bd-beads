# 147: Saved Patterns: recent thumbnails, expandable

**What to build:** Saved Patterns becomes the box in `DESIGN.md` §5.8 and §5.9: the five most recently saved Patterns as round thumbnails with name and size below, the open Pattern ringed in `--accent`, a hover or focus × Remove, and a ↓ expand button. Expanded, it shows every Pattern plus a footer with Export Pattern and Export all. Clicking a thumbnail opens that Pattern. It uses the last-saved order from ticket 145 and the expandable panel from ticket 146.

**Blocked by:** 145, 146

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: SavedPatterns, SavedPatternsExpanded. Names are one line cut with an ellipsis at 58px, the full name in a tooltip (`writing.md`).

- [ ] The collapsed body shows the five most recently saved Patterns (104px); expanded shows all, plus the footer with `--line-soft` rule and two 32px secondary buttons
- [ ] A thumbnail is a 44px circle on `--elevated` holding the Pattern's own 36px thumbnail, name (at most 58px wide, two lines) and size in meta-tiny
- [ ] The open Pattern has the accent ring and accent name; Remove is a 20px round button at the circle's top-right, shown on hover or keyboard focus, and keeps today's remove behavior and confirmation
- [ ] Saving a Pattern moves it to the front of the list; the header meta reads "5 of 12"
- [ ] Export Pattern and Export all keep working as they do today
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from `DESIGN.md` §3
- [ ] Correct in both the light and the dark theme
- [ ] Matches `docs/design/light.png` and `dark.png` for what they show, and `DESIGN.md` for the rest
- [ ] Thumbnail names are one line with an ellipsis and the full name as a tooltip
