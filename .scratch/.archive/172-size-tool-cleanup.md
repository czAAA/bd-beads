# 172: Size tool cleanup: remove inline steppers, rename action, route through confirmation

**What to build:** Remove the inline "fewer/more columns/rows" stepper controls from the Size tool group entirely — size and unit changes now happen only through the size-change action's confirmation modal. Rename "Change size…" to a clearer verb-based label with no ellipsis. The size-change button opens the existing confirmation modal directly, with no intermediate step.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Fewer/more columns/rows stepper controls removed from the Size tool group
- [ ] Size-change action has a new, ellipsis-free label describing "change size and unit"
- [ ] Clicking it opens the confirmation modal directly
- [ ] Verified whether the orange tooltip on this control was already fixed by #152's design-token pass; fixed here if not
