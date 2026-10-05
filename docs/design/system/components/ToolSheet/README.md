# ToolSheet

The bottom sheet a Dock button opens on the phone, holding every option of that kind.

- **Tools (ticket 292):** Paint, Fill, Select, Eraser, Hand and Frame as the Toolbox's tabs (up to 56px wide, 72px tall, 34px icon, wrapping rather than shrinking below 44px, a full-width `line-strong` rule per row, the active one marked by a 2px accent underline; flagged for a visual check on a real phone), then Remove line and Clear (`danger`), then Remove line and Clear (`danger`). Phone and Dock tiles keep their size and labels on purpose: they are thumb targets, not the desktop Toolbox tiles. **Hotkey corner (repo, ticket 275):** each tool tile also prints its key (1 to 6) in the top-right corner, as the Dock does: DM Mono 12px (nothing is below 12px on a phone), `muted`, `accent` on the active tile, absolutely positioned so the icon and label stay centered (`aria-hidden`, `kc`). Remove line and Clear have no key.
- **Colour:** the Palette as 5-column swatches (selected: `ring`), Image colors, Custom colour.
- **Edit:** Undo, Redo, Rotate, Copy, and Paste (enabled after Copy).
- **Frame (v16, in Size's place):** Set Frame, Fit to drawing, Columns and Rows steppers, Remove Frame, and the measured size with its info. The preview still draws the v15 Size sheet.
- **Pattern:** Save Pattern and Export (QR code, PNG, PDF), the Bead pill and Replace bead, Beads needed, Saved Patterns, New Pattern, Import file, Import QR.
- Tool sheets are light: `panel`, 18px top corners, a grab handle, title and close; no scrim and only as tall as their content, so the Pattern stays in view. The Pattern sheet is modal: taller, with the scrim; its header carries the Canvas color button between the title and Close (CanvasBackground).
- Swipe down, the close button, Escape, tapping the Pattern or the same Dock button closes a sheet. Sheets slide with `transform`; the drawing surface never resizes.

Hand-written from the responsive sign-off; static rendition.
