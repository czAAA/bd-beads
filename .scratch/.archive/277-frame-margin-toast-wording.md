# 277: Frame margin Message: say what the Frame did and where the beads were

**What to build:** The Message shown when setting, moving or resizing a Frame moves beads out of its margin names the action, as the `Frame` and `Message` cards say: "Frame set.", "Frame moved." or "Frame resized.", then "1 bead was in the margin and moved outside it." (plural "2 beads were in the margin…"). Today `i18n/en.ts` says "1 bead was too close to the Frame and moved outside it." with no lead, and `useFrameFlow.ts` uses one key for all three actions. The count stays a count of beads, not of Pieces (a Piece is a group of touching beads), so the cards' "1 piece" is corrected in ticket 284 to "1 bead". The Message keeps its single Undo step. Russian gets the same three leads; the Russian wording is reviewed in ticket 283. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** done

- [x] Set, move and resize each produce their own lead, in English and Russian; the Rotate Message keeps its own wording
- [x] Singular and plural English and Russian forms are correct for the bead count (the existing plural helper)
- [x] The Undo step, timeout and hold-while-hovered behaviour are unchanged
- [x] `writing.md` and the `Message` and `Frame` cards carry the final wording; the README Version changelog has a line
