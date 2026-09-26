# ScreenReaders

Landmarks, the accessible name of the Pattern, a name for every icon-only button, and what gets announced.

- Landmarks: `header`, the left column as `aside` "Tools", the canvas box as `main`; phone ToolSheets are `dialog`s named by their title.
- The Pattern is `role="img"` with a name that sums it up ("Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done"); Beads needed is its text equivalent.
- Icon-only buttons are named with the app's own words (Undo, Zoom in, Turn row direction, Row not done, More, Tools…); a swatch is "Color 1, red".
- Results are `role="status"` (polite): "Row 13 of 30", "Saved", "Patterns imported: 3". Errors are `role="alert"`. One announcement per action.

Hand-written from the Phase C sign-off.
