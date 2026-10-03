# Dock

The phone's six buttons, one per kind of tool, each opening its own ToolSheet: the active tool, Colour, Edit, Mirror, Frame, Pattern.

- 64px tall plus `env(safe-area-inset-bottom)`, on `canvas` with a 1px `line-soft` rule above. Items are 60px wide: a 22px icon over an 11px label (`muted`).
- The first button shows the active tool's icon and name in `accent`; Colour shows the current colour as a 22px swatch with a ring. The button whose sheet is open sits on `panel`.
- Landscape (height up to 499px): the dock becomes a 64px rail on the left edge.
- The consumer provides the active tool, the current colour and which sheet is open.
- **Frame (v16, in Size's place):** the `frame` icon. Its sheet holds Set Frame, Fit to drawing, the Columns and Rows Steppers and Remove Frame. While the Frame is being set the button sits on `panel` and the ContextBar shows the size, Fit to drawing and Done.
- Hand joins the tools in the first button's sheet; two fingers always move the canvas.

Hand-written from the responsive sign-off; static rendition.
