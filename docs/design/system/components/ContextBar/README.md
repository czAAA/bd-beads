# ContextBar

A floating bar above the Progress bar under 1024px that offers what a Selection can do, and, while the Frame is being set, the Frame bar.

- While a Selection exists: its size (`meta`), Copy, Rotate, Remove line and a clear ×, on `ink` with `canvas` text, 14px radius, `elevation-3`.
- After Copy it turns `accent` (`on-accent` text): "Tap where to paste", Rotate and Cancel.
- 10px from the screen edges, 40px buttons with 13px labels.
- **While the Frame is being set (v16), the Frame bar (ticket 295):** the Frame's size ("17×17 · 2.7 × 2.7 cm", `meta`), Fit to drawing (icon only), Remove Frame (✕, only when a Frame is set) and Done (check icon and label), on `ink`. It floats at the **top-centre of the canvas box** over the beads, 10px from its top, instead of taking a row above the Progress bar, and never covers the Dock. Done sets the Frame. Not drawn in the preview yet.

Hand-written from the responsive sign-off; static rendition.
