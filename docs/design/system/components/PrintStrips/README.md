# PrintStrips

Long thin framed Schemas (bracelets) and leftover parts stack several boards on one sheet; the PNG always puts its story under the chart.

- **Strips**: a long narrow Schema whose whole chart is under 3 mm a bead is folded into strips, equal parts placed side by side (or stacked, for a wide flat one) on page 1 (ticket 0914), when that gives a bigger bead than the whole Schema by more than 0.05 mm (ticket 0913). A 35 × 120 bracelet is two strips of 60 rows at about 2.2 mm, the whole PDF; a 15 × 200 three strips at about 3.3 mm. Each strip after the first repeats `print-part-overlap` rows of the one before.
- Parts of a Schema printed on several sheets share one when they fit at the PDF's bead, placed in reading order. Each sits on its own pad (outline only, PrintChartPage) with its rulers and a label 2 mm above it, "part B · columns 101–130 · rows 1–100", and the pads are 6 mm apart. The bead is the same on every sheet.
- Every bead carries its Swatch letter and the rulers number every row and column, as on PrintChartPage; a chart page has one "Colors on this page" key, page 1 its Beads needed.
- The PNG: the chart at full width; under it the technique word, name, maker, bead and size on the left, Beads needed in two columns with beads and grams on the right, and the brand and date at the bottom.

**Approved 2026-11-19, not yet in the app (tickets 1126, 1127; signed off in ticket 1123):** strips and shared parts are drawn as the new chart (PrintChartPage card): no lines between beads and no bold edge, one rounded rim round the beads with the numbers outside it while Chart border is on, empty positions as Empty grid says. The Schema is trimmed to its beads before it is folded (ticket 1128, in the app), and every row and column is numbered (ticket 1129, in the app): a strip counts on from the one before it: the second strip of a 35 × 120 bracelet numbers its rows 59, 60 (the overlap, `faint`), 61, 62… to 120. Every ruler number on the sheet, all strips together, is one size (PrintChartPage card), smaller than 6.5 pt only where the sheet's widest number needs it. Its label uses the same numbers.

## Acceptance

- [ ] A 35 × 120 bracelet gives 1 × 2 parts side by side on page 1 at about 2.2 mm, each on its own outlined pad, 6 mm apart.
- [ ] Each shared part has its label above its pad, and the sheet has a single key (on page 1, Beads needed).

Rewritten for the export sheets signed off on 2026-10-26 (ticket 0575) and the chart look of 2026-10-27 (ticket 0585); the earlier card (parts at the 4.6 mm base size) is in git history.
