# 46: Mirror current across strips

**What to build:** Each direction's "Mirror current" button does a one-time sync of what's already painted using that direction's axes: the strip holding the most painted cells becomes the source and is copied onto every other strip — as mirror images by default, or unflipped when copy mode is on. If that direction's count is 0, it acts as if there were 1 center axis, so the button always does something. One undo step; rows already woven stay locked as with other drawing commands.

Part of the rich mirror feature (flag introduced in ticket 44): with `VITE_RICH_MIRROR` off, Mirror current keeps today's "bigger half" behaviour across the center.

**Blocked by:** 44, 45

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Replaces the "bigger half" heuristic with "strip with the most painted cells" (ADR 0006 amendment). With 1 axis this is the same as before.
- Honours copy mode.
- Tie-breaking between equally painted strips: pick the first strip (leftmost/topmost), matching today's behaviour for equal halves.

- [ ] Count 0: behaves as a single center-axis mirror in that direction
- [ ] Count N: the fullest strip is copied onto all others, mirrored alternately
- [ ] With copy mode on, it is copied unflipped
- [ ] One Undo reverts it
- [ ] Woven rows are left untouched while Row progress is on
- [ ] With the rich mirror flag off, Mirror current behaves exactly as today (existing tests pass unchanged)
