# 150: Convert image framing and preview restyle

**What to build:** The Convert image flow (choosing an image, the framing step, the palette and preview) looks like the rest of the redesigned app: the framing step takes the canvas box and the New Pattern panel, and the preview draws with the light `PatternTheme` from ticket 140. Controls and messages use the new templates.

**Blocked by:** 140, 143, 149

**Status:** done

**Design system v13:** The component card(s) in `docs/design/system/components/` are the spec: ConvertImage.

- [x] The framing step lives inside the canvas box and the left-column panel, and its drag, zoom and scroll behavior is unchanged (including tickets 104 and 122)
- [x] The preview uses `PatternTheme` and the board look rather than its own colors
- [x] Controls, sliders and buttons follow the design tokens and variants; any uncovered need is added to the design system on claude.ai first (`DESIGN.md` §2)
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] Existing Convert image tests pass

**Done (ticket 150):** framing is inside the canvas box: the canvas strip's title names the step ("Choose what becomes the Pattern") beside the frame's size and zoom, the beads are drawn with the light PatternTheme on its board (the draft look already was), the frame is a 2px accent outline with everything outside it dimmed black at 45% (`--framing-dim`), and the pan hint sits on the picture, bottom-left. The controls (Colors at most as the new AppStepper, the Colors found swatches and count, Cancel and Create Pattern) are teleported into a slot at the canvas box's bottom, in the Progress bar's place; mounted alone, ConvertImageFrame keeps them under the preview. Drag, zoom and the draft look during a drag are untouched. The card's pinch to scale belongs to the touch work (ticket 166).
