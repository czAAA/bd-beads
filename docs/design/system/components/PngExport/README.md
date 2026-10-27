# PngExport

The PNG export: the **Cover page** (PrintPage1 card) as one A4 portrait picture, drawn by the same code as the PDF's first page.

- Title block, the framed Schema with its rulers (a number every 5, or 10 when the beads are small, a hairline every 10), Beads needed and the footer, in the order and at the sizes of the PrintPage1 card, inside the 10 mm margin (`print-margin`).
- Drawn at 150, 300 or 450 dpi by the Export quality (QualitySlider card), like a PDF page: 1240 × 1754, 2480 × 3508 or 3720 × 5262 px. A device that cannot hold a 450 dpi page draws High at 300.
- The PNG has no pages to point at, so the lines where the chart parts meet and their page pills are not drawn; the PDF's chart pages carry the detail.
- Beads needed that does not fit continues on list pages: further PNG files, `bd-beads-{pattern}_2.png`, `_3.png`, handed over in order after the cover (and before the Word chart's `_instructions` picture). One page still gives one file.
- No wide layout, no watermark. Drawn in the app's language. File name `bd-beads-{pattern}.png`.

Rewritten in ticket 0583 (one Cover page for the PNG and the PDF); the earlier card (one tall picture, the story under the chart, a bead 45, 60 or 90 px across, the 400 megapixel ceiling) is in git history.
