# 150: Convert image framing and preview restyle

**What to build:** The Convert image flow (choosing an image, the framing step, the palette and preview) looks like the rest of the redesigned app: the framing step takes the canvas box and the New Pattern panel, and the preview draws with the light `PatternTheme` from ticket 140. Controls and messages use the new templates.

**Blocked by:** 140, 143, 149

**Status:** ready-for-agent

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: ConvertImage.

- [ ] The framing step lives inside the canvas box and the left-column panel, and its drag, zoom and scroll behavior is unchanged (including tickets 104 and 122)
- [ ] The preview uses `PatternTheme` and the board look rather than its own colors
- [ ] Controls, sliders and buttons follow the design tokens and variants; any uncovered need is added to `DESIGN.md` as Derived first
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from `DESIGN.md` §3
- [ ] Correct in both the light and the dark theme
- [ ] Existing Convert image tests pass
