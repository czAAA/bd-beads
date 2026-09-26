# ToolSheet

The bottom sheet a Dock button opens on the phone, holding every option of that kind.

- **Tools:** Paint, Fill, Select, Erase as 72px tiles (the active one outlined in `accent`), then Remove line and Delete all (`danger`).
- **Colour:** the Palette as 5-column swatches (selected: `ring`), Image colors, Custom colour.
- **Edit:** Undo, Redo, Rotate, Copy, and Paste (enabled after Copy).
- **Mirror:** left–right and top–bottom axis steppers, Copy mode switch, Mirror current both ways.
- **Size:** Columns and Rows steppers, Change from end / start, Estimated size with its info.
- **Pattern:** Save Pattern and Export (QR code, PNG, PDF), the Bead pill and Replace bead, Beads needed, Saved Patterns, New Pattern, Import file, Import QR.
- Tool sheets are light: `panel`, 18px top corners, a grab handle, title and close; no scrim and only as tall as their content, so the Pattern stays in view. The Pattern sheet is modal: taller, with the scrim.
- Swipe down, the close button, Escape, tapping the Pattern or the same Dock button closes a sheet. Sheets slide with `transform`; the drawing surface never resizes.

Hand-written from the responsive sign-off; static rendition.
