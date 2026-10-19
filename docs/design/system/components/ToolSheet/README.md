# ToolSheet

The sheet a Dock button or the Canvas strip's Menu or Project button opens, holding every option of that kind.

- **Tools (gone, ticket 431):** the Tool sheet and its tiles are removed; the six tool tiles are in the Dock (Dock card). Remove line and Name piece are on the Context bar only; Select all is its button. **Delete all** (`danger`) moved to the bottom of the Project sheet, with its usual confirmation.
- **Colour:** replaced by the colour popover anchored to the Tool pill (ToolPill card); until that ships, the Palette as 5-column swatches (selected: `ring`), Custom colour.
- **Edit:** Undo, Redo, Copy, and Paste (enabled after Copy). Rotate is on the Selection bar (ticket 416).
- **Frame (v16, in Size's place):** Set Frame, Fit to drawing, the beads | mm switch, Width and Height steppers, Remove Frame, and the measured size with its info. The preview still draws the v15 Size sheet.
- **Pattern:** Save Pattern and Export (PNG, PDF), the Bead pill and Replace bead, Beads needed, Saved Patterns, New Pattern, Import file, and last Delete all (ticket 431). The sheet opens from the Canvas strip's Project button.
- Tool sheets are light: `panel`, 18px top corners, a grab handle, title and close; no scrim and only as tall as their content, so the Pattern stays in view. The Pattern sheet is modal: taller, with the scrim; its header carries the Canvas color button between the title and Close (CanvasBackground).
- Choosing a Palette swatch, a Custom color or an Image color closes the sheet it was chosen in (every pick control does, through the sheet). A Custom color closes when its native dialog commits, not while it is still being dragged.
- Tapping or dragging the grab handle down, the close button, Escape, and a press anywhere outside the sheet (the modal Pattern sheet too) close a sheet. An outside press only closes: it and its click reach nothing under them, so no stroke, fill or Frame starts and a Dock button does not re-open the sheet it closed. A press inside another dialog is not outside. Sheets slide with `transform`; the drawing surface never resizes.

Hand-written from the responsive sign-off; static rendition.
