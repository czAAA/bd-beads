# PngExport

The PNG export: the **Cover page** as one A4 portrait picture. Until ticket 0914 it was also the PDF's first page; the PDF now opens with its own page 1 (PrintPage1 card), and ticket 0915 makes the PNG that page as a picture.

- Title block, the framed Schema with its rulers (a number every 5, or 10 when the beads are small, a hairline every 10), Beads needed (two columns of swatch, name, beads and grams, then the Total and the grams note) and the footer (the mark and "openbeads" on the left, the date and time on the right), the bead capped at `print-cover-bead-max` (6 mm), the board taking what the title block and Beads needed (at most 40% of the room) leave, inside the 10 mm margin (`print-margin`).
- Drawn at 150, 300 or 450 dpi by the Export quality (QualitySlider card), like a PDF page: 1240 × 1754, 2480 × 3508 or 3720 × 5262 px. A device that cannot hold a 450 dpi page draws High at 300.
- The PNG has no pages to point at, so the lines where the chart parts meet and their page pills are not drawn; the PDF's chart pages carry the detail.
- Beads needed that does not fit continues on list pages: further PNG files, `{project}-{frame}-{maker}_2.png`, `_3.png`, handed over in order after the cover. One page still gives one file.
- The PNG is the picture a maker shares, so it never carries Swatch letters (neither on the board nor on the Beads needed swatches), whatever the Letters toggle says; the PDF keeps them.
- An empty position shows the board, as a missing bead does in a real piece, with a small cross in `faint` over its middle (ticket 0719): two diagonals across 40% of the bead, `print-line-cell` thick and never under one device pixel, barely seen but printed, so a pale bead is never taken for empty. The PDF's overview keeps it too, as every chart does (ticket 0818). A White bead keeps its drawn bead (outline and shading), so it never reads as empty.
- No wide layout, no watermark. Drawn in the app's language. File name `{project}-{frame}-{maker}.png` (ticket 0720, printed-output.md).
- Once handed over, the one saved-file toast names it, "Saved: {file}" (Message card, ticket 0859), as for the PDF and the Project file; each further list page stacks a toast of its own. "Export" names the PNG and PDF only; the Project file is saved, never exported.

Rewritten in ticket 0583 (one Cover page for the PNG and the PDF); the earlier card (one tall picture, the story under the chart, a bead 45, 60 or 90 px across, the 400 megapixel ceiling) is in git history.
