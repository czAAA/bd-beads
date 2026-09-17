# 41: Tool groups with more than 14 controls expand in place

**What to build:** A Tool group holding more than 14 controls shows only the first 14 while collapsed, looking exactly as it does today plus a small expand chevron icon on its bottom border that signals there's more. When the pointer enters the group, the group itself grows downward to reveal every control, laying over the canvas below rather than pushing the layout down. It collapses as soon as the pointer leaves the group, or when Escape is pressed.

**Blocked by:** 40

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Not a separate dropdown or popup: the group's own box extends downward.
- The indicator is an expand/chevron icon, not a "+N" count.
- The expanded group overlays the canvas so nothing shifts under the cursor.
- Escape precedence: while a group is expanded, Escape only collapses it; the next Escape reaches Select as before (cancel Paste, then clear Selection).
- No current group exceeds 14 (Colors is 13 once ticket 43 lands), so verify with a group fed more than 14 controls in tests.

- [ ] A group with ≤14 controls shows no chevron and never expands
- [ ] A group with >14 controls shows the first 14 plus a chevron icon on its bottom border
- [ ] Hovering the group expands it downward in place, overlaying the canvas without moving it
- [ ] Moving the pointer out of the group collapses it
- [ ] Escape collapses an expanded group without cancelling a pending Paste or clearing the Selection; a second Escape does that as before
