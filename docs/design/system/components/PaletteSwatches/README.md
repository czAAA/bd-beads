# PaletteSwatches

The Colors group: the Pattern's Palette as an 8-column grid of square swatches that grows by rows from 12 to 40, then Custom and Image colors.

- **Grid:** 8 columns, gap 6, square swatches, radius-sm, inset 1px `swatch-edge` so ivory and black do not vanish.
- **Contents:** the 12 built-in swatches first, then every Custom color that joined the Palette by painting a cell, in the order it was added. Up to 28 can be added, so the group holds 12 to 40 swatches.
- **Grows by rows beyond twelve:** the 12 built-in swatches take a row and a half; added swatches 13 to 16 complete the second row, and each further eight add a row, up to five full rows at 40. The grid wraps; it never clips and never scrolls sideways. The Toolbox grows with it.
- **Added swatches** look and behave exactly like built-in ones: the same size, the same inset edge, the same selected ring, the same focus ring.
- **Selected:** `0 0 0 2px panel, 0 0 0 4px ring`. **Focus:** 2px `focus-ring`, 2px away.
- **Touch** (`pointer: coarse`): `repeat(auto-fill, minmax(36px, 1fr))` instead of 8 columns, the same 6px gap, so swatches stay at least 36px.
- **Shortcuts:** only the first 12 swatches have one (Shift+1 to 9, Shift+0, Q, W). Added swatches have no shortcut, so their tooltip shows just the color and hex.
- **Accessible names:** every swatch has one. A built-in swatch is "Color 1, black"; an added swatch is named by its hex ("#6b3fa0").
- **Palette is full:** with 28 colors already added, a new Custom color still paints but is not added, and a toast says so (see the Message card).
- 12px below: two equal buttons: **Custom** (a 12px swatch of the custom color, radius 3, then the label) and **Image colors** (image icon; `faint` while the Pattern has no Image colors). Unchanged by the longer grid.
- The swatch colors are the Pattern's bead colors (user data), never brand colors. The consumer provides them and the selected index.

Hand-written from DESIGN.md §5.5 and the v16 Palette change; static rendition. The preview shows 12, 16 and 40 swatches at the Toolbox's 264px content width, then the touch layout. The first 12 are the built-in Palette colors (see the Glossary card); the added ones are sample bead colors.
