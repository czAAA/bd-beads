# FoundColorRow

One color Convert image found in the picture: what it became, how many beads, and the ways to change it. The rows make the Colors section's list, most beads first. (Ticket 0646, spec 0645.)

- **Row:** `panel-row-two-line` (40; 48 on touch), padding 0 4 0 6, a 1px `line-soft` rule above. In order: the picture's color (20px swatch, radius 4, `swatch-edge`); the arrow (12px `arrow-down` turned, `muted`); the matched color (20px; a dashed 1px `field-line` outline 1px out while the Bead color's hex is generated, as in BeadColors); two lines, the code or name in `control` (a hex in DM Mono) over the source in `meta-small` `muted`, each wrapping when it is long (the build wraps rather than ellipsizes: a family and Finish such as Polish "Niebieski · Nieprzezroczysty" is wider than the row leaves it on a phone, and an ellipsis would hide the Finish); the bead count in `meta` `ink`, right-aligned; the actions.
- **What the lines say:**
  - a Bead color: "DB723" over "Red · Opaque";
  - a Default Palette color: "Red" over "Default Palette";
  - Exact: "#d8312b" over "Custom color";
  - kept exact: "#f2c230" over "Kept exact · Custom color";
  - remapped: "Remapped · " before the source line ("Remapped · Green · Opaque");
  - empty: the matched swatch is an empty bead (`bead-empty`, a dashed `field-line` edge) and the lines read "Empty" over "No bead".
- **Actions:** two 28px icon buttons, `aria-pressed`, an `ink` fill with a `canvas` icon when on: Remap (`paint`, also `aria-expanded`; on for a remapped or kept-exact row) and Empty (`erase`), each a control registry entry with a Tooltip (ticket 0650): "Pick the bead color this picture color becomes." and "Leave this color out, so its beads stay empty." Pressing the one that is on puts the row back to its match. Keep exact has no button of its own: it sits in the remap picker's head. Treat as empty on the preview (ConvertImage card) presses Empty on the row under the tap.
- **Remap opens the row in place**, one row at a time: the row takes `surface` (`elevated` in dark; a 2px `line` edge in high contrast) and the picker hangs under it, padding 4 10 12. The picker is the colour popover's body (ToolPill card), built from the same components, so remapping and adding a color work as they do when painting:
  - **Head**, as the popover's head: the picture's color as a 20px swatch, "Picture color" in `control` with its hex in `meta-small` under it, and **Keep exact** at the right (a small in-box button, `aria-pressed`, `ink` fill when on): it keeps the picture's own color, which joins the Palette as a Custom color.
  - **The Palette** ("palette of the new Project" in `label`): the PaletteSwatches grid, 8 columns, 6 apart, at the popover's 260px width, holding the Palette the new Project will get: its Brand's built-in colors, then every color the conversion uses that is not one of them, as added swatches. The current target carries the selected `ring`. Picking a swatch remaps the found color to it; picking one another found color already uses merges the two. Pick color from canvas is left out (the preview's eyedropper is Treat as empty).
  - **Custom color**, the grid's last tile as in the popover (ColorPickers card): it opens the wheel, brightness slider and hex field under the grid; leaving them takes the color, which becomes the target and joins the grid as an added swatch.
  - **Palette {bead}** (in-box, with a chevron; only when the Bead has a Color catalog; "Palette Miyuki Delica 11/0", ticket 0745), under the grid as in the popover: it opens the BeadColors list in its narrow layout, as the picker is under 480px wide (the Info button with the approximate note, the search with its Filters disclosure holding the Color and Finish filters with their live counts, the count line and empty state (ticket 0713), the rows; a code whose hex the Palette holds says "In the Palette"; the current target has a check). Picking a code remaps to it and the code joins the grid.
  - A pick applies at once and the preview redraws. Escape (or Remap again) closes the picker and returns focus to Remap. It opens in the row, not over the page, so a press elsewhere goes through and leaves it open.
- The mapping is applied after the snap, so changing the source keeps every keep, remap and empty and redoes the rest.
- **Screen readers:** each row is a `group` named "{picture hex} to {matched name}, {count} beads"; the swatches and the arrow are `aria-hidden`.

Hand-written from the ticket 0646 design session; static rendition.
