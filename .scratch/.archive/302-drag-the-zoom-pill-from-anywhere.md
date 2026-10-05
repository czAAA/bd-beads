# 302: Drag the Zoom pill from anywhere on it, and remove its handle

**What to build:** The Zoom pill has no drag handle (the six dots at its left end, ticket 297). Instead it moves when it is dragged from any part of it: the gaps, the zoom level and the buttons alike. A tap on a button still presses that button; only a drag past a small distance (about 6px) moves the pill, and a drag that starts on a button does not press it when released. The pill's other behaviour stays as ticket 297 made it: it stays inside the canvas box, follows the pointer without easing, and on release glides to the nearest corner, which is kept on the device. Dragging the pill never draws or pans the canvas.

The pill gets shorter by the handle's width, so the Text fit check and the pill's corner offsets are re-checked at 320px.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The handle is gone from the Zoom pill and from the ZoomPill card in the design system (README changelog line, `preview` and the card's text); its Tooltip and its name "Move the zoom controls" are removed in English and Russian
- [ ] A drag from any point on the pill, with a finger, the Pencil or the mouse, moves it; it snaps to the nearest corner on release as before
- [ ] A tap or click without a drag still presses the button under it (Rulers, Undo, Redo, Row progress toggle, zoom out, zoom in, Fit); a drag that starts on a button never presses it
- [ ] While the pill is dragged, the Tooltip of the button under the pointer stays closed and the canvas below is not painted or panned
- [ ] A keyboard user can still move the pill to another corner (recommended: Alt + an arrow key while focus is anywhere in the pill, announced once), since the handle was its keyboard target
- [ ] The pill still fits at 320px with no text cut off, and its corners do not cover the Progress bar or the Frame bar
- [ ] Unit tests for the drag threshold, the suppressed click and the keyboard move; the existing handle tests are replaced
