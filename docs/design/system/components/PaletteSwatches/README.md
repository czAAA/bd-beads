# PaletteSwatches

The Colors group: the Pattern's Palette as an 8-column grid of square swatches that grows by rows from 12 to 40, then Custom and Image colors.

- **Grid:** 8 columns, gap 6, square swatches, radius-sm, inset 1px `swatch-edge` so ivory and black do not vanish.
- **Contents:** the 12 built-in swatches first, then every Custom color that joined the Palette by painting a cell, in the order it was added. Up to 28 can be added, so the group holds 12 to 40 swatches.
- **Grows by rows beyond twelve:** the 12 built-in swatches take a row and a half; added swatches 13 to 16 complete the second row, and each further eight add a row, up to five full rows at 40. The grid wraps; it never clips and never scrolls sideways. The Toolbox grows with it.
- **Added swatches** look and behave exactly like built-in ones: the same size, the same inset edge, the same selected ring, the same focus ring.
- **Selected:** `0 0 0 2px panel, 0 0 0 4px ring`. **Focus:** 2px `focus-ring`, 2px away (the app now matches; it was 4px).
- **Touch** (`pointer: coarse`): `repeat(auto-fill, minmax(36px, 1fr))` instead of 8 columns, the same 6px gap, so swatches stay at least 36px.
- **Shortcuts:** only the first 12 swatches have one (Shift+1 to 9, Shift+0, Q, W). Added swatches have no shortcut, so their tooltip shows just the color and hex.
- **Accessible names:** every swatch has one. A built-in swatch is "Color 1, black"; an added swatch is named by its hex ("#6b3fa0").
- **Removing an added swatch:** a small × badge sits on the top-right corner of an added swatch while that swatch is selected or has keyboard focus. Built-in swatches never show it and cannot be removed.
  - Badge: 16px round (`space-16`), `panel` fill, 1px `line-strong`, a 10px `close` icon in `ink`, centred on the corner (6px out, `space-6`), above the selected ring. The same look as the Remove badge on Saved Patterns, smaller. On touch it shows on the selected added swatch and takes a 28px hit area (ticket 166), not the usual 44px `touch-target`: swatches are 6px apart, so a 44px zone would cover the neighbouring swatches.
  - Name: "Remove #6b3fa0 from the Palette" (Russian «Убрать #6b3fa0 из палитры»). It is not a Tab stop; the keyboard uses the keys below.
  - Keyboard: Delete or Backspace on a focused added swatch removes it (`aria-keyshortcuts="Delete Backspace"` on added swatches only). Focus moves to the next swatch, or to the previous one if it was the last. While a swatch has focus these keys act on the swatch, not on the Erase tool or the Selection.
  - After removal the grid closes the gap and a toast offers Undo (see the Message card). Undo puts the swatch back in its place, selected again if it was selected.
- **Palette is full:** with 28 colors already added, a new Custom color still paints but is not added, and a toast says so (see the Message card).
- **Tools sit on this grid (v18):** the Tools group above uses the same 8 columns, 6px gap and square size, so tool tiles and swatches line up (ToolTabs card).
- 12px below: two equal buttons: **Custom** (a 14px hatched square in `muted`, always, never a fill of the chosen colour, then the label; the hatch stands for "pick any color") and **Image colors** (image icon; `faint` while the Pattern has no Image colors). Unchanged by the longer grid.
- The swatch colors are the Pattern's bead colors (user data), never brand colors. The consumer provides them and the selected index.

Hand-written from DESIGN.md §5.5 and the v16 Palette change; static rendition. The preview shows 12, 16 and 40 swatches at the Toolbox's 264px content width, then the touch layout, with the × badge on the selected and the focused added swatches. The first 12 are the built-in Palette colors (see the Glossary card); the added ones are sample bead colors.
