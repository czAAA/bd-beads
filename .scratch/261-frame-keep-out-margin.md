# 261: Keep-out margin around the Frame

**What to build:** Once a Frame is set, the 3 bead positions all the way around it, outside its line, are a margin where nothing can be drawn, so beads never end up right up against the Frame. A subtle shaded band marks the margin while the Frame is set. Paint, Fill, Paste, Mirror and Rotate all respect it; Erase still works on anything. Setting, moving or resizing a Frame so its margin covers existing beads moves those beads clear (outward, like Rotate moves a Piece in the way), with a Message and one Undo that restores the beads and the Frame. This replaces the 233 rule that drawing right next to the Frame is allowed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] With a Frame set, no tool can place a bead within 3 positions of the Frame's outside edge; strokes crossing the margin paint only the allowed beads and one stroke is still one Undo step
- [ ] Fill, Paste and Mirror never write into the margin; Rotate keeps it clear and still never loses or overwrites a bead
- [ ] Setting, moving or resizing the Frame moves any beads that land in the margin clear, with a Message ("N beads were too close to the Frame and moved outside it.", English and Russian) and a single Undo step
- [ ] Removing the Frame removes the margin and the band; drawing next to the old Frame position works again
- [ ] The band uses role-named design system tokens in light, dark and high contrast
- [ ] Design system, edited locally in this ticket by the owner's decision (the owner carries it back to claude.ai by hand, so this ticket overrides the "don't edit `docs/design/system/` by hand" rule): the Frame card (README and preview) shows the margin band, with any new token added to `tokens.json`, and the Message card gets the "too close to the Frame" copy in English and Russian; the change is listed in the PR description so it can be copied out
- [ ] Beads already saved in a margin (older Patterns) open unchanged and are handled the first time the Frame is edited, not on load
- [ ] Export, Beads needed and Row progress are unchanged (they count the Frame only)
- [ ] CONTEXT.md and a new or amended ADR record the margin and what it changes in the open canvas model
- [ ] Correct on phone through desktop, by pointer, touch and keyboard
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
