# 228: Remove a Palette color that was added from a Custom color

**What to build:** A swatch that joined the Palette from a Custom color (ticket 227) can be removed again, so the Palette doesn't fill up with colors that were tried once. The twelve built-in swatches cannot be removed. Cells already painted with a removed color keep it, and still show up in Bead quantities, because cells store the hex rather than a swatch. If the removed swatch was the active paint color, painting continues with the Palette's default color rather than with nothing selected.

**Blocked by:** 227 (A Custom color joins the Palette the first time it paints a cell). The removal control must also be drawn in the PaletteSwatches card on claude.ai and synced (`/design-sync`).

**Status:** ready-for-agent

- [ ] Every added swatch has a way to remove it, reachable by pointer, touch and keyboard; built-in swatches offer none
- [ ] Removing a swatch leaves painted cells, Bead quantities and exports unchanged
- [ ] Removing the active swatch switches the paint color to the default Palette color
- [ ] The removal survives a reload, and the same hex can be added again later by choosing and using it
- [ ] Removing a swatch at the 24-color limit frees a slot, so the next new Custom color used is added again
- [ ] An accidental removal is cheap to undo or needs a confirmation, following whichever the design system uses for similar actions
- [ ] Correct at all five screen sizes and in the light, dark and high contrast themes; copy in English and Russian; design system tokens only
- [ ] CONTEXT.md's Palette entry mentions removal
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)
