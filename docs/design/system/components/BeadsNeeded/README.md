# BeadsNeeded

An expandable panel listing how many beads of each color the Pattern needs, with the total in its title.

- **Expandable panel template:** a box that shows a fixed-height summary and grows downward when expanded. Header 28px tall, 8px to the body: title (`control`) with an optional muted suffix in body weight, optional meta on the right, then the Expand button (↓; ↑ when expanded, with an "esc" kbd hint). Escape or ↑ collapses it.
- Box: elevation 1, padding 14 20 16.
- Body: up to 3 color rows while collapsed (32px each, 96px), each with a 1px `line-soft` rule above: a 12px swatch (radius 3, inset `swatch-edge`), the color name (`body`, `body` color) and the count (`meta`, `ink`, right-aligned). Expanded, every color shows.
- Each row shows the count and, after it, the weight in `meta` `muted` ("2.5 g"): count ÷ the Bead's beads per gram (a catalog field), rounded up to 0.1 g. The title adds the total weight ("· 1 200 · ≈ 6 g"). An unknown Bead shows no grams.
- Numbers group thousands with a no-break space: "1 200".
- **One face of a Kaleidocycle (ticket 0876):** its counts are one face of four, so under the rows, in `meta` `muted`, "These counts are one face of 4. Whole piece: 3 240" (the total four times over), and an Info button named "What the counts cover": the piece's faces, a Frame for each other face, and that only the triangles are counted.
- **Counts the Frame only (v16):** beads outside the Frame are not counted. With no Frame the panel keeps its header and says "Set Frame to count beads." (EmptyPanels).

**In the Frame panel (tickets 0555, 0852):** Beads needed is the Frame panel's section right after size, above settings, so it is in view as the panel opens; not an expandable box: the total in its PanelSection header, kept there while open, `panel-row` rows (14px swatch, the color label, count, grams), five shown, then "Show all colors ({n})" opens the rest in place.
- **The weight's Info button (ticket 0852):** right after the header's label, shown while there is a weight, named "How the weight is worked out". Its Tooltip says the facts only, no advice: "This is bead count × about 0.0108 g per bead. The average is from the maker's beads per kilogram, or from seller listings where the maker gives none. Real beads vary by color and finish." The average is written with the language's decimal sign ("около 0,0108 г"). The beads per kg are TOHO's and Miyuki's published figures (TOHO's Beads Per Kg Chart, Miyuki's Size and Bead Count Data); TOHO Cube 1.5mm, which TOHO doesn't list, keeps seller listings' figure. It counts the Frame only, so it is absent with no Frame. In Convert image's Review (ticket 0759) the same section opens closed every time and keeps its state nowhere, for the Project about to be created.

**The color label (ticket 0760):** a catalog color reads "49 Opaque Black" in `control`, the code and the catalog's name for it, in the one label the Palette, the colour popover and FoundColorRow use too; its hex is only in a Tooltip, on hover and long-press. A Palette color with no code reads as its Palette name ("Red"), a Custom color as its hex in DM Mono with no Tooltip. The label wraps rather than being cut.

Hand-written from DESIGN.md §5.8; static rendition.
