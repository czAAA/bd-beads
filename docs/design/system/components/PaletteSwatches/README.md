# PaletteSwatches

The Colors group: the Pattern's Palette as an 8-column grid of square swatches, then Custom and Image colors.

- Grid gap 6, square swatches, radius-sm, inset 1px `swatch-edge` so ivory and black do not vanish. Wraps to more rows when the Palette grows.
- **Selected:** `0 0 0 2px panel, 0 0 0 4px ring`.
- 12px below: two equal buttons: **Custom** (a 12px swatch of the custom color, radius 3, then the label) and **Image colors** (image icon; `faint` while the Pattern has no Image colors).
- The swatch colors are the Pattern's bead colors (user data), never brand colors. The consumer provides them and the selected index.

Hand-written from DESIGN.md §5.5; static rendition. Swatch colors in the preview are sample bead colors.
