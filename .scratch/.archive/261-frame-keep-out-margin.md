# 261: Keep-out margin around the Frame

**What to build:** Once a Frame is set, the 3 bead positions all the way around it, outside its line, are a margin where nothing can be drawn, so beads never end up right up against the Frame. A subtle shaded band marks the margin while the Frame is set. Paint, Fill, Paste, Mirror and Rotate all respect it; Erase still works on anything. Setting, moving or resizing a Frame so its margin covers existing beads moves those beads clear (outward, like Rotate moves a Piece in the way), with a Message and one Undo that restores the beads and the Frame. This replaces the 233 rule that drawing right next to the Frame is allowed.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] With a Frame set, no tool can place a bead within 3 positions of the Frame's outside edge; strokes crossing the margin paint only the allowed beads and one stroke is still one Undo step
- [x] Fill, Paste and Mirror never write into the margin; Rotate keeps it clear and still never loses or overwrites a bead
- [x] Setting, moving or resizing the Frame moves any beads that land in the margin clear, with a Message ("N beads were too close to the Frame and moved outside it.", English and Russian) and a single Undo step
- [x] Removing the Frame removes the margin and the band; drawing next to the old Frame position works again
- [x] The band uses existing design system tokens (the dot color at half strength) in light, dark and high contrast; the design system has no card for it yet, so adding one on claude.ai (DESIGN.md §6) is still to do
- [x] Beads already saved in a margin (older Patterns) open unchanged and are handled the first time the Frame is edited, not on load
- [x] Export, Beads needed and Row progress are unchanged (they count the Frame only)
- [x] CONTEXT.md and a new or amended ADR record the margin and what it changes in the open canvas model
- [x] Correct on phone through desktop, by pointer, touch and keyboard
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
