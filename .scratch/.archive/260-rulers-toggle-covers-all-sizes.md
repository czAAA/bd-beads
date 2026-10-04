# 260: Rulers toggle shows or hides every size

**What to build:** The Rulers toggle (button, R and the phone ZoomPill) shows or hides all the size markings on the canvas, not only the Frame's. With no Frame that means every Piece's rulers and size labels; with a Frame it means the Frame's rulers too. Hidden means nothing numeric is drawn for any Piece or Frame, and the choice is still saved as a preference. Clicking a ruler number to select a row or column keeps working while they are shown, and does nothing while hidden.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Toggle off: no Piece ruler or size label and no Frame ruler is drawn, with and without a Frame, including while the Frame is being set
- [x] Toggle on: they all return, as today
- [x] The setting persists across reload and the button and R stay in sync
- [x] Correct on phone through desktop and in light, dark and high contrast
- [x] CONTEXT.md's Rulers toggle entry says it covers every ruler
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
