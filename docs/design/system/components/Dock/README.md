# Dock

The phone layout's five icon-only buttons, each opening its own sheet: the active tool, Colour, Frame, Pattern and Menu (ticket 295). There is no Mirror button: the app hides Mirror pending a redesign (ticket 174). The Edit button is gone: Undo and Redo move to the Zoom pill (ticket 296), and Rotate, Copy and Paste join the Frame sheet.

- **48px** tall plus `env(safe-area-inset-bottom)`, at most 480px wide and centred, on `canvas` with a 1px `line-soft` rule above, in portrait and landscape alike (there is no left rail). Five equal slots, a 22px icon each, `muted`. **No text labels at any height:** each button's name is its accessible name and its Tooltip.
- **Same icons, key and underline as the Toolbox (v18, ticket 292):** the selected tool carries the Toolbox's 2px accent underline; the first button shows the active tool's own icon (`paint`, `fill`, `select`, `erase`, `hand`) and its hotkey in the top-right corner (1, 2, 3, 4, 5), and the Frame button shows `frame` and 6: DM Mono 12px (nothing is below 12px on a phone), `muted`, 3px from the top and 6px from the right, `accent` on the active tool. Colour, Pattern and Menu are not tools and have no key.
- The first button shows the active tool's icon in `accent`; Colour shows the current colour as a 22px swatch with a ring. The button whose sheet is open sits on `panel`.
- **Slots:** Tool, Colour, Pattern (`pattern` icon), Menu (`menu` icon, last). There is no Frame slot (ticket 417): the Frame is edited on the canvas, from the Project sheet or a Selection.
- **Input mode toggle (ticket 325):** once a pen has been seen (ticket 326) a sixth slot, the Pen mode / Mouse mode toggle, comes first (bottom-left). It shows `pen-mode` (Pen mode) or `pen-mode-off` (Mouse mode) in `accent`, with no underline and no key; `aria-pressed` is true in Pen mode, and its Tooltip names the mode and what it does. It opens no sheet.
- **Frame (v16, gone in ticket 417):** the Frame slot and its sheet are removed. Technique, Edit Frame, Fit to drawing and Remove Frame are in the Pattern (Project) sheet; Rotate, Copy and Paste are on the Selection bar (tickets 415 and 416); Undo and Redo are in the Zoom pill. While the Frame is being edited its bar floats just above the Frame (ContextBar and Frame cards).
- **Next (tickets 414 and 417; not in the app yet):** the first button can show `piece` (key 6) as the active tool; `select-all` (key 7) is an action in the Tool sheet, not a tool: pressing it selects every piece and leaves Select active. The Selection bar is the ContextBar card.
- **Menu:** a modal sheet with Language, Theme, Name on exports, Keyboard shortcuts (only with a keyboard or fine pointer attached), Overview and Source code. Everything about the open Pattern stays in the Pattern sheet; nothing is repeated.
- **No Pattern open:** the New Pattern / Import bar takes the Dock's place, with the Menu button at its bottom right, so language and theme stay reachable.
- The consumer provides the active tool, the current colour and which sheet is open.
- Hand joins the tools in the first button's sheet; two fingers always move the canvas.

Hand-written from the responsive sign-off; static rendition.
