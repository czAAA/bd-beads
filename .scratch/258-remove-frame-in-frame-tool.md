# 258: Remove Frame from the Frame tool

**What to build:** The Frame tool in the tool panel gets a Remove Frame action, so a person can clear the Frame and set a new one without opening the Toolbox's Frame row. Today Remove Frame lives only inside the open Frame row (and the phone sheet). It is available whenever a Frame is set, on every screen size, by pointer, touch and keyboard.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] With a Frame set, the Frame tool offers Remove Frame; with none, it is absent or disabled
- [ ] Removing leaves every bead untouched and the tool ready to draw a new Frame; one Undo restores the old Frame
- [ ] Works at all five screen sizes (phone 390, iPad mini 744, iPad 1024, laptop 1440, desktop 1920), in light, dark and high contrast, and with the keyboard alone (announced to screen readers)
- [ ] Copy in English and Russian; design system tokens and icons only
- [ ] Design system, edited locally in this ticket by the owner's decision (the owner carries it back to claude.ai by hand, so this ticket overrides the "don't edit `docs/design/system/` by hand" rule): the Frame and Toolbox cards (README and preview) show Remove Frame on the Frame tool, in English and Russian; the change is listed in the PR description so it can be copied out
- [ ] The existing Remove Frame in the Frame row keeps working
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
