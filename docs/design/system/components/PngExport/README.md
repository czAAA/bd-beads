# PngExport

The PNG export: **page 1 of the PDF as a picture** (ticket 0915; PrintPage1 card), one A4 portrait page drawn by the same code as the PDF's page 1. The page is described once and drawn twice: its chart as PDF operators in the PDF and painted on the canvas in the PNG, from the same calls, so at the same size the two show the same bead size, letters, rulers and Beads needed table.

- A piece that fits page 1 is the chart itself, as page 1 prints it: lettered (a Swatch letter on every bead, whatever the Letters toggle says), numbered on all four sides, the lines every 5 and 10, a bracelet folded into strips each under its label; Beads needed under it (letter swatch, color name, code, beads, grams, to buy, the Total and the grams note), the title block over it and the footer.
- A piece cut into parts is page 1's overview: the whole piece on the board without letters, its rulers, an empty position under its small `faint` cross. The PNG has no pages to point at, so the lines where the chart parts meet and their page pills are not drawn; the PDF's chart pages carry the detail.
- The footer is page 1's (the mark, "openbeads" and the date and time on the left), its number counting the PNG's own files ("1 / 1", "1 / 2").
- Drawn at 150, 300 or 450 dpi by the Export quality (QualitySlider card): 1240 × 1754, 2480 × 3508 or 3720 × 5262 px. A device that cannot hold a 450 dpi page draws High at 300. The PDF is not affected.
- The chart's Swatch letters and ruler numbers are set in the PDF's Helvetica, or the face the device has in its place (Arial, Liberation Sans), as a PDF viewer would take; the rest of the text is the print fonts (Inter, DM Mono, Instrument Serif).
- Beads needed that does not fit continues on list pages, page 1's: further PNG files, `{project}-{frame}-{maker}_2.png`, `_3.png`, handed over in order after page 1. One page still gives one file.
- No wide layout, no watermark. Drawn in the app's language. File name `{project}-{frame}-{maker}.png` (ticket 0720, printed-output.md).
- Once handed over, the one saved-file toast names it, "Saved: {file}" (Message card, ticket 0859), as for the PDF and the Project file; each further list page stacks a toast of its own. "Export" names the PNG and PDF only; the Project file is saved, never exported.

Rewritten in ticket 0915: until then the PNG was the Cover page (the whole Schema on the board at up to `print-cover-bead-max`, 6 mm a bead, no Swatch letters, Beads needed as swatch, name, beads and grams), drawn apart from the PDF. Ticket 0583's earlier card (one tall picture, the story under the chart) and the Cover's are in git history.
