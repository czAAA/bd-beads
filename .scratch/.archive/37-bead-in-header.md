# 37: Show the Pattern's Bead in the header

**What to build:** A Pattern is woven from a single Bead, so the header's status box shows which one while a Pattern is open, next to the current-pattern summary, e.g. "TOHO Round 11/0". It updates when you switch to another Pattern and disappears when no Pattern is open.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- The Bead shows only in the header, not in the Saved Patterns list (which uses the same Pattern summary text today).
- If the Pattern's Bead can't be found (for example a custom Bead removed in ticket 38, or an imported file), the header shows a neutral "unknown bead" label instead of breaking or showing a raw id.

- [ ] With a Pattern open, the header status box shows its Bead's label (brand, name, size)
- [ ] Switching Patterns updates the Bead shown
- [ ] With no Pattern open, no Bead is shown
- [ ] A Pattern whose Bead isn't in the catalog shows an "unknown bead" label, translated in both languages
- [ ] The Saved Patterns list is unchanged
