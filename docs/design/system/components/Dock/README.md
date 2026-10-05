# Dock

The phone layout's five icon-only buttons, each opening its own sheet: the active tool, Colour, Frame, Pattern and Menu (ticket 295). There is no Mirror button: the app hides Mirror pending a redesign (ticket 174). The Edit button is gone: Undo and Redo move to the Zoom pill (ticket 296), and Rotate, Copy and Paste join the Frame sheet.

- **48px** tall plus `env(safe-area-inset-bottom)`, at most 480px wide and centred, on `canvas` with a 1px `line-soft` rule above, in portrait and landscape alike (there is no left rail). Five equal slots, a 22px icon each, `muted`. **No text labels at any height:** each button's name is its accessible name and its Tooltip.
- **Same icons, key and underline as the Toolbox (v18, ticket 292):** the selected tool carries the Toolbox's 2px accent underline; the first button shows the active tool's own icon (`paint`, `fill`, `select`, `erase`, `hand`) and its hotkey in the top-right corner (1, 2, 3, 4, 5), and the Frame button shows `frame` and 6: DM Mono 12px (nothing is below 12px on a phone), `muted`, 3px from the top and 6px from the right, `accent` on the active tool. Colour, Pattern and Menu are not tools and have no key.
- The first button shows the active tool's icon in `accent`; Colour shows the current colour as a 22px swatch with a ring. The button whose sheet is open sits on `panel`.
- **Slots:** Tool, Colour, Frame, Pattern (`pattern` icon), Menu (`menu` icon, last).
- **Frame (v16):** the `frame` icon. Its sheet holds Set Frame, Fit to drawing, the Columns and Rows Steppers, Remove Frame, then Rotate, Copy and Paste (Undo and Redo too until ticket 296 moves them). While the Frame is being set the button sits on `panel` and the Frame bar floats at the top-centre of the canvas box (ContextBar card).
- **Menu:** a modal sheet with Language, Theme, Name on exports, Keyboard shortcuts (only with a keyboard or fine pointer attached), Overview and Source code. Everything about the open Pattern stays in the Pattern sheet; nothing is repeated.
- **No Pattern open:** the New Pattern / Import bar takes the Dock's place, with the Menu button at its bottom right, so language and theme stay reachable.
- The consumer provides the active tool, the current colour and which sheet is open.
- Hand joins the tools in the first button's sheet; two fingers always move the canvas.

Hand-written from the responsive sign-off; static rendition.
