# FoundColorRow

One color Convert image found in the picture: what it became, how many beads, and the ways to change it. The rows make the Colors section's list, most beads first. (Ticket 0646, spec 0645.)

- **Row:** `panel-row-two-line` (40; 48 on touch), padding 0 4 0 6, a 1px `line-soft` rule above. In order: the picture's color (20px swatch, radius 4, `swatch-edge`); the arrow (12px `arrow-down` turned, `muted`); the matched color (20px; a dashed 1px `field-line` outline 1px out while the Bead color's hex is generated, as in BeadColors); two lines, the code or name in `control` (a hex in DM Mono) over the source in `meta-small` `muted`, one line each with an ellipsis; the bead count in `meta` `ink`, right-aligned; the actions.
- **What the lines say:**
  - a Bead color: "DB723" over "Red · Opaque";
  - a Default Palette color: "Red" over "Default Palette";
  - Exact: "#d8312b" over "Custom color";
  - kept exact: "#f2c230" over "Kept exact · Custom color";
  - remapped: "Remapped · " before the source line ("Remapped · Green · Opaque");
  - empty: the matched swatch is an empty bead (`bead-empty`, a dashed `field-line` edge) and the lines read "Empty" over "No bead".
- **Actions:** two 28px icon buttons, `aria-pressed`, an `ink` fill with a `canvas` icon when on: Remap (`paint`, also `aria-expanded`; on for a remapped or kept-exact row) and Empty (`erase`). Pressing the one that is on puts the row back to its match. Keep exact has no button of its own: it is the remap picker's first choice. Treat as empty on the preview (ConvertImage card) presses Empty on the row under the tap.
- **Remap opens the row in place**, one row at a time: the row takes `surface` (`elevated` in dark; a 2px `line` edge in high contrast) and the picker hangs under it, padding 4 10 12:
  - tabs, a small SegmentedControl: the source (Default Palette, or Picture colors under Exact; none extra when the source is Bead colors), Bead colors (only when the Bead has a Color catalog), Custom color;
  - **Keep exact** under the tabs, the first choice: a row with the picture's own color, the words and its hex in `meta-small`: picking it keeps the color as it is, joining the Palette as a Custom color;
  - "used here" and the colors the conversion already uses, as swatches, the current target ringed (`ring`, 2px out): picking one merges two found colors into one;
  - the tab's body: the BeadColors list with its search (the picked code ringed in `ink`, a check at the right), the 8-column swatch grid, or the ColorPickers wheel, brightness slider and hex field (taken on leaving it, as ColorPickers).
  - A pick applies at once and the preview redraws. Escape closes the picker and returns focus to Remap.
- The mapping is applied after the snap, so changing the source keeps every keep, remap and empty and redoes the rest.
- **Screen readers:** each row is a `group` named "{picture hex} to {matched name}, {count} beads"; the swatches and the arrow are `aria-hidden`.

Hand-written from the ticket 0646 design session; static rendition.
