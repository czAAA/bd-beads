# ToolSheet

The bottom sheet a Dock button opens on the phone, holding every option of that kind.

- **Tools:** Paint, Fill, Select, Erase and Hand (v16) as 72px labelled tiles (the active one outlined in `accent`), then Remove line and Clear (`danger`). Phone and Dock tiles keep their size and labels on purpose: they are thumb targets, not the desktop Toolbox tiles. **Hotkey corner (repo, ticket 275):** each tool tile also prints its key (1, 2, 3, E, H) in the top-right corner, as the Dock does: DM Mono 12px (nothing is below 12px on a phone), `muted`, `accent` on the active tile, absolutely positioned so the icon and label stay centered (`aria-hidden`, `kc`). Remove line and Clear have no key. The preview does not draw the corner yet; ticket 275 adds it.
- **Colour:** the Palette as 5-column swatches (selected: `ring`), Image colors, Custom colour.
- **Edit:** Undo, Redo, Rotate, Copy, and Paste (enabled after Copy).
- **Mirror:** left–right and top–bottom axis steppers, Copy mode switch, Mirror current both ways.
- **Frame (v16, in Size's place):** Set Frame, Fit to drawing, Columns and Rows steppers, Remove Frame, and the measured size with its info. The preview still draws the v15 Size sheet.
- **Pattern:** Save Pattern and Export (QR code, PNG, PDF), the Bead pill and Replace bead, Beads needed, Saved Patterns, New Pattern, Import file, Import QR.
- Tool sheets are light: `panel`, 18px top corners, a grab handle, title and close; no scrim and only as tall as their content, so the Pattern stays in view. The Pattern sheet is modal: taller, with the scrim.
- Swipe down, the close button, Escape, tapping the Pattern or the same Dock button closes a sheet. Sheets slide with `transform`; the drawing surface never resizes.

Hand-written from the responsive sign-off; static rendition.
