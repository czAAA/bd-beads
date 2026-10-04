# 258: Remove Frame from the Frame tool

**What to build:** The Frame tool in the tool panel gets a Remove Frame action, so a person can clear the Frame and set a new one without opening the Toolbox's Frame row. Today Remove Frame lives only inside the open Frame row (and the phone sheet). It is available whenever a Frame is set, on every screen size, by pointer, touch and keyboard.

**Blocked by:** None (can start immediately).

**Status:** done

**Where:** the Toolbox's Tools group gets a Frame tool (starts Set Frame) with a Remove Frame link beside it; the ContextBar, while setting, gets a Remove Frame button (phone and iPad mini). Remove Frame now leaves Set Frame on.

- [x] With a Frame set, the Frame tool offers Remove Frame; with none, it is absent or disabled
- [x] Removing leaves every bead untouched and the tool ready to draw a new Frame; one Undo restores the old Frame
- [x] Works at all five screen sizes (phone 390, iPad mini 744, iPad 1024, laptop 1440, desktop 1920), in light, dark and high contrast, and with the keyboard alone (announced to screen readers)
- [x] Copy in English and Russian; design system tokens and icons only
- [x] Design system, edited locally in this ticket by the owner's decision (the owner carries it back to claude.ai by hand, so this ticket overrides the "don't edit `docs/design/system/` by hand" rule): the Frame and Toolbox cards (README and preview) show Remove Frame on the Frame tool, in English and Russian; the change is listed in the PR description so it can be copied out
- [x] The existing Remove Frame in the Frame row keeps working
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
