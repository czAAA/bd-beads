# 286: No bead cursor when F starts Set Frame

**What to build:** Pressing F to start Set Frame moves focus to the Project so the arrow keys can move the Frame. That focus counted as keyboard focus, so the bead cursor (the yellow BeadCursor outline) showed up on a single bead at the Frame's top-left, or wherever it was last. It looked like a 1×1 selection under the pointer. During Set Frame the arrows move the Frame, so the cursor did nothing there. While Set Frame is on, the bead cursor is hidden and isn't hovered or announced, and the canvas strip shows the Frame's key hint (`frame.keyboardHint`, added in 233 but never used) instead of the painting hint. When Set Frame ends with focus still on the Project, the cursor and the painting hint come back.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] F on an open Project focuses it with no bead cursor drawn, no hover moved to the cursor's bead and no cursor announcement
- [x] The canvas strip hint reads the Set Frame keys (English and Russian) while Set Frame is on with keyboard focus
- [x] Enter or Escape ends Set Frame, and the bead cursor and the painting hint show again
- [x] Tests: `useKeyboardCursor.test.ts` and `App.frame.test.ts`
