# 14: Restructure app shell into a tool-app layout

**What to build:** Reorganize the current app layout into a three-panel tool-app shell — top bar, left tool sidebar, center canvas, right context panel — in the spirit of the attached reference screenshot (a generic drawing app). Borrow only the *structure* from the reference, not its feature set: bd-beads has a different, smaller functional scope, and the new layout should surface exactly that scope and nothing else.

**Target layout (bd-beads features only):**
- **Top bar:** app name, current Pattern indicator (name/summary, ticket 05), language switcher (ticket 03)
- **Left sidebar — tools:** Palette color picker and paint tool (ticket 07), fill tool (ticket 08), mirror axis toggles (ticket 09), undo/redo (ticket 07), Technique/canvas size controls (tickets 01, 06), clear/reset
- **Center:** the Pattern grid/canvas
- **Right sidebar — context panel:** saved Patterns list/switcher (ticket 05), row progress toggle (ticket 13), bead catalog and color-to-bead quantity summary (tickets 10, 11), export/import actions (ticket 12)

**Explicitly out of scope** (present in the reference screenshot but not part of bd-beads): login/sign-up, gallery, "Animate", image upload/library/objects, a generic layers panel, object clone/flip/shadow/opacity controls.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] App shell renders as four regions matching the reference's structure: top bar, left tool sidebar, center canvas, right context panel
- [ ] Every control placed in the new layout maps to an existing or planned bd-beads feature per the Target layout above; none of the explicitly-out-of-scope reference features are added
- [ ] All functionality that already works today (pattern painting, pattern switching, i18n, etc.) keeps working after the move — this is a reorganization of existing/planned UI, not new feature work
- [ ] A feature whose ticket isn't implemented yet simply has no control in the shell yet, rather than a placeholder/stub for it
- [ ] Layout uses the design tokens from ticket 02 rather than one-off styling
