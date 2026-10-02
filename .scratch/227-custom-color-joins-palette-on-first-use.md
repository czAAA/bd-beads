# 227: A Custom color joins the Palette the first time it paints a cell

**What to build:** The Custom color button stays exactly as it is: the same system color picker, the same swatch and ring. What changes is that a Custom color no longer disappears when the next one is chosen. The first time a chosen Custom color is used to paint a cell, it is added to the Palette as a new swatch placed right after the last one (after the twelve built-in colors, then after each previously added one). Every new Custom color repeats this on its first use. Once added, the swatch is selected and used like any other Palette swatch, on every Pattern, and it is still there after a reload. Choosing a color without painting anything adds nothing. A color that is already in the Palette (a built-in one, or one added earlier, compared by hex) is never added twice; choosing it from the picker simply selects the matching swatch. At most 24 colors can be added (so the Palette tops out at 36 swatches); once 24 are added, a new Custom color still paints as before but is not added, and the user is told why. Added swatches have no keyboard shortcut. They are kept on the device, like the theme and the maker name (ADR 0001), not inside a Pattern, so Patterns painted with them still open fine elsewhere because cells store the hex.

**Blocked by:** None (can start immediately). The Colors group grows by rows beyond twelve swatches; the PaletteSwatches card of the design system must say so on claude.ai and be synced (`/design-sync`) before this ships, per CLAUDE.md's Design section.

**Status:** ready-for-agent

- [ ] Choosing a Custom color and painting one cell with it adds a swatch after the last Palette swatch; painting more cells with it adds nothing more
- [ ] Choosing a Custom color and not painting leaves the Palette unchanged
- [ ] A hex that matches a built-in or an already-added swatch is never added twice, and selects that swatch instead
- [ ] Each new Custom color, once used, is added after the previous added one, in the order first used
- [ ] An added swatch is selectable, shows the selected ring, paints, fills and appears in Bead quantities like any Palette swatch
- [ ] Added swatches are saved on the device and are present after a reload and on every Pattern
- [ ] Opening a Pattern on a device that lacks the added swatches still shows its cells in their colors
- [ ] With 24 added swatches, using a further new Custom color paints normally, adds nothing, and shows a short English/Russian notice that the limit is reached
- [ ] Added swatches have no shortcut, and the shortcut list and tooltips do not claim one
- [ ] The Colors group wraps onto more rows as swatches are added, with no clipping or horizontal scroll, at all five screen sizes and in the light, dark and high contrast themes; usable with the keyboard alone, and each swatch has an accessible name
- [ ] Uses the design system tokens only; matches the updated PaletteSwatches and ColorPickers cards
- [ ] CONTEXT.md's Palette and Custom color entries (and the "Avoid" lines) are updated, and an ADR records that the Palette is no longer fixed
- [ ] Copy exists in English and Russian wherever new text appears
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)
