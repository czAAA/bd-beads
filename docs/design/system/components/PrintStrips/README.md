# PrintStrips

Long thin framed Schemas (bracelets) and leftover parts stack several boards on one sheet; the PNG always puts its story under the chart.

- **Strips**: a long narrow Schema whose whole chart is under 3 mm a bead is folded into strips, equal parts placed side by side (or stacked, for a wide flat one) on one sheet, when that gives a bigger bead than the whole Schema by more than 0.05 mm (ticket 0913). A 35 × 120 bracelet is two strips of 60 rows at about 2.3 mm; a 15 × 200 three strips at about 3.3 mm. Each strip after the first repeats `print-part-overlap` rows of the one before.
- Parts of a Schema printed on several sheets share one when they fit at the PDF's bead, placed in reading order. Each sits on its own pad (outline only, PrintChartPage) with its rulers and a label 2 mm above it, "part B · columns 101–130 · rows 1–100", and the pads are 6 mm apart. The bead is the same on every sheet.
- Every bead carries its Swatch letter and the rulers count in fives, as on PrintChartPage; the sheet has one "Colors on this page" key.
- The PNG: the chart at full width; under it the technique word, name, maker, bead and size on the left, Beads needed in two columns with beads and grams on the right, and the brand and date at the bottom.

## Acceptance

- [ ] A 35 × 120 bracelet gives 1 × 2 parts side by side on one sheet at about 2.3 mm, each on its own outlined pad, 6 mm apart.
- [ ] Each shared part has its label above its pad, and the sheet has a single key.

Rewritten for the export sheets signed off on 2026-10-26 (ticket 0575) and the chart look of 2026-10-27 (ticket 0585); the earlier card (parts at the 4.6 mm base size) is in git history.
