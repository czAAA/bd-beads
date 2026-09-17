# 39: Bottom section with a dimmed divider and three boxes

**What to build:** The area below the canvas starts with a faint, dimmed horizontal divider, followed by exactly three boxes in this order: Beads needed, Saved Patterns, Export and import. On narrow screens the boxes still wrap into a single column in the same order.

**Blocked by:** 38 (the Bead catalog box must be gone first)

**Status:** ready-for-agent

**Decisions (2026-09-16):**
- Recorded as an amendment note on ADR 0004 (already written).
- The divider spans only the width of the canvas column, not the full page width.
- The divider is visually dimmed (muted color, thin), so it separates the bottom section without competing with the boxes' borders.

- [ ] A dimmed horizontal divider renders between the canvas area and the bottom boxes, as wide as the canvas column
- [ ] Exactly three boxes render below it, in order: Beads needed, Saved Patterns, Export and import
- [ ] The layout holds with and without an open Pattern
- [ ] At phone width the boxes stack in one column in the same order, with no horizontal page scroll
