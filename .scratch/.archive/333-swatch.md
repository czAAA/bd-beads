# 333: Swatch: one color chip for the Palette, Image colors and Canvas color

**What to build:** `Swatch`: one color chip used by the Palette, the Image colors popover and the Canvas color popover. It takes a color, `selected`, an optional key chip (palette `Shift+1…9, 0, Q, W`) and an optional remove ×. Its Tooltip has the name "Color", the hex as the body and the key chip when it has one. Its `aria-label` keeps the color's name and position.

The remove × (on the active added color, and on any added color while a mouse or Apple Pencil hovers it; never from touch hover): a round ×, top-right inside the swatch, with no background. It is drawn in `ink` or `canvas`, whichever has more contrast with that swatch's hex (the same logic as the Bead cursor). The glyph is about 10px, with an invisible hit area of at least 24×24 (WCAG 2.5.8). Update the PaletteSwatches card.

**Spec:** 343 (unified controls spec)

**Blocked by:** 327

**Status:** done

- [x] `Swatch` covers all three places
- [x] The Tooltip shows "Color", the hex and the key chip where there is one
- [x] The × is readable on light and dark swatches and has a hit area of at least 24×24
- [x] The design-system card and changelog are updated
