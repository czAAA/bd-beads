# BeadsNeeded

An expandable panel listing how many beads of each color the Pattern needs, with the total in its title.

- **Expandable panel template:** a box that shows a fixed-height summary and grows downward when expanded. Header 28px tall, 8px to the body: title (`control`) with an optional muted suffix in body weight, optional meta on the right, then the Expand button (↓; ↑ when expanded, with an "esc" kbd hint). Escape or ↑ collapses it.
- Box: elevation 1, padding 14 20 16.
- Body: up to 3 color rows while collapsed (32px each, 96px), each with a 1px `line-soft` rule above: a 12px swatch (radius 3, inset `swatch-edge`), the color name (`body`, `body` color) and the count (`meta`, `ink`, right-aligned). Expanded, every color shows.
- Each row shows the count and, after it, the weight in `meta` `muted` ("2.5 g"): count ÷ the Bead's beads per gram (a catalog field), rounded up to 0.1 g. The title adds the total weight ("· 1 200 · ≈ 6 g"). An unknown Bead shows no grams.
- Numbers group thousands with a no-break space: "1 200".
- **Counts the Frame only (v16):** beads outside the Frame are not counted. With no Frame the panel keeps its header and says "Set Frame to count beads." (EmptyPanels).

**In the Frame panel (ticket 0555):** Beads needed is the Frame panel's last section, not an expandable box: the total in its PanelSection header, `panel-row` rows (14px swatch, the color label, count, grams), five shown, then "Show all {n} colours" opens the rest in place. It counts the Frame only, so it is absent with no Frame. In Convert image's Review (ticket 0759) the same section opens closed every time and keeps its state nowhere, for the Project about to be created.

**The color label (ticket 0760):** a catalog color reads "49 Opaque Black" in `control`, the code and the catalog's name for it, in the one label the Palette, the colour popover and FoundColorRow use too; its hex is only in a Tooltip, on hover and long-press. A Palette color with no code reads as its Palette name ("Red"), a Custom color as its hex in DM Mono with no Tooltip. The label wraps rather than being cut.

Hand-written from DESIGN.md §5.8; static rendition.
