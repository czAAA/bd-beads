# PixelToBeadRatio

How Convert image's Size section sets a Pixel to bead ratio (glossary): picture pixels : beads, one side always 1, read at a glance. Also the result line both Size modes share. (Ticket 0646, spec 0645.)

- **Label:** "picture pixels : beads" in `label` above the chips.
- **Chips:** 1:4, 1:2, 1:1, 2:1, 4:1, 8:1 and Custom, one row that wraps, 6 apart: `item-height` (34) tall, at least `--ratio-chip-min` (40) wide, padding 0 9, `radius-md`, a 1px `line-strong` edge on `elevated`, every label in DM Mono 13. The chosen chip is `accent` with `on-accent`, the section's one accent. A `radiogroup` named by the label; each chip a `radio` named "2:1, picture pixels : beads". Drawn by the shared ChipRadioGroup (ticket 0650): one Tab stop (the chosen chip, else the first), the arrows, Home and End move focus and a press chooses. Each chip is a control registry entry (ADR 0035), so its name and Tooltip come from one place: the name, then the explainer's sentence for that ratio ("Every 2 × 2 pixel block is one bead."), and for Custom "Set your own number of pixels per bead, or beads per pixel."
- **Custom:** the last chip, the word in the same DM Mono as the ratios so the row reads as one set; named "Custom ratio". Chosen, a small Stepper (2 to 32) and a small SegmentedControl, pixels per bead | beads per pixel, sit under the chips.
- **Explainer:** a small drawing beside a sentence in `body`, both redrawn with the choice, in the picture's own leading color. For n:1, an n × n block of pixel squares (at most 8 a side drawn, 1px `canvas` gaps, a 1px `line-strong` edge) over "n × n px", the arrow (`arrow-down` turned, `muted`), and one bead (22 × 18, the bead's corner radius and `bead-rim`) over "1 bead". For 1:n, one pixel over "1 px" and an n × n group of beads (at most 4 a side) over "n × n beads". The drawing is `aria-hidden`; the sentence is read: "Every 2 × 2 pixel block is one bead.", "Every pixel is one bead.", "Every pixel is 2 × 2 beads."

## Result line

- One formatter for By Pixel to bead ratio and By size: a box on `surface` (`elevated` in dark, a 2px `line` edge in high contrast), `radius-lg`, padding 10 12, the `label` "result" over one `meta` line in `body`: the grid size in `ink` at 500 ("32×24 beads": writing.md's Grid size, no spaces), the measured size through the Bead ("5.1 × 3.1 cm"), and the ratio ("1 bead = 8 × 8 px"; 1:n, "1 px = 2 × 2 beads"; By size, with ≈, "1 bead ≈ 4.3 × 3.5 px", or "=" where the size is a whole ratio).
- A non-square Bead shows in the cm: 1:1 on Delica 11/0 (1.6 × 1.3 mm) is wider than the picture.
- `role="status"`, read once after a change settles. The footer repeats it with the color count in place of the ratio ("32×24 beads · 5.1 × 3.1 cm · 8 colors").

Hand-written from the ticket 0646 design session; static rendition.
