# 304: Custom colors always show ×, and removing one asks first

**What to build:** Every added Custom color swatch in the Palette shows its × badge all the time, not only while it is the selected one. Built-in swatches still have none. Clicking × (or pressing Delete or Backspace on a focused added swatch) opens a confirmation dialog, in the existing confirmation-modal style, instead of removing the swatch at once. Cancel leaves the swatch alone; Confirm removes it. After Confirm the existing Undo toast still appears, and painted cells keep their color as today. Dialog copy in English and Russian. The × must stay usable by touch and on a phone, and must not shift the swatch grid.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Every added swatch shows the × without being selected or focused; built-in swatches never do
- [ ] × click and Delete/Backspace both open a confirmation naming the color; Cancel (button, Escape, backdrop) removes nothing; Confirm removes the swatch and shows the Undo toast
- [ ] The × has a screen-reader name, is reachable by keyboard and touch, does not change the grid layout or the swatch's selection on click, and fits at 320px
- [ ] Copy exists in English and Russian
- [ ] The design system is updated in place (PaletteSwatches card README and `preview.html`, a line in the README Version changelog) and `CONTEXT.md`'s Palette entry describes always-visible × and the confirmation
- [ ] Tests (unit and e2e/visual where affected) cover the new behaviour; existing visual baselines are updated if they change
