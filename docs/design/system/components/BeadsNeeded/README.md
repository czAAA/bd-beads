# BeadsNeeded

An expandable panel listing how many beads of each color the Pattern needs, with the total in its title.

- **Expandable panel template:** a box that shows a fixed-height summary and grows downward when expanded. Header 28px tall, 8px to the body: title (`control`) with an optional muted suffix in body weight, optional meta on the right, then the Expand button (↓; ↑ when expanded, with an "esc" kbd hint). Escape or ↑ collapses it.
- Box: elevation 1, padding 14 20 16.
- Body: up to 3 color rows while collapsed (32px each, 96px), each with a 1px `line-soft` rule above: a 12px swatch (radius 3, inset `swatch-edge`), the color name (`body`, `body` color) and the count (`meta`, `ink`, right-aligned). Expanded, every color shows.
- Each row shows the count and, after it, the weight in `meta` `muted` ("2.5 g"): count ÷ the Bead's beads per gram (a catalog field), rounded up to 0.1 g. The title adds the total weight ("· 1 200 · ≈ 6 g"). An unknown Bead shows no grams.
- Numbers group thousands with a no-break space: "1 200".

Hand-written from DESIGN.md §5.8; static rendition.
