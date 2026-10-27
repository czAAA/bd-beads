# Printed output

The PDF and PNG exports of a framed Schema: the chart is the main thing on every page, every bead countable, with the facts and the beads to buy set clearly around it. Signed off in the design session of 2026-10-26 (ticket 0575, "Gallery").

## Look and feel

- **The chart comes first.** The Cover page shows the whole Schema across the full width of the sheet; every chart page shows one part with every row and column numbered. Everything else is small and sits around the board, so the page works at the craft table.
- **The canvas, on paper.** On the Cover page the Schema sits on a pale rounded board (`print-board`) like the app's canvas. A chart page has no board fill, only a thin rounded outline (`print-pad-line`, `print-pad-radius`), so only beads take toner. The technique word is set in Instrument Serif italic in `accent` next to the Project's name.
- **Open, with no watermarks.** Nothing is drawn behind or over the chart or the text: no background maker's name, no X1 marks, no accent line, no signature on the beads. The PDF and PNG are meant to be shared. The maker's name is still printed as information (Made by, the header, "by {maker}").
- **Accent marks structure only**: the technique word, the lines where the chart parts meet, the part labels and the current part on the mini map. Text is `ink` or `muted`. A black-and-white printer turns the accent gray and loses no information: every bead on a chart page carries its letter.
- **On every page**: the X1 mark and "bd-beads" (small, in the header or footer, never as a background), technique and name, the maker's name, the export date and time, "page 2 / 9".
- Inter for text, DM Mono for numbers and meta, Instrument Serif italic for the technique word and the maker's name, loaded before drawing. A4 portrait, 10 mm margins (`print-margin`); nothing under 6.5 pt; Row progress fades never print.

## The order of the pages

1. **Cover page** (ticket 0583): the title block, the whole Schema and Beads needed; the PNG is this page alone. Beads needed that does not fit continues on **list pages** straight after it.
2. **Chart pages**: the parts, in reading order (across, then down).
3. **Specification**: the full legend with beads, grams and what to buy, the facts and the page map.
4. **Word chart** pages, only when Letters is on (ticket 0574).

## Cover page

One A4 portrait page for both formats, drawn by the same code, inside a 10 mm margin on all four sides (`print-margin`). The PDF opens with it; the PNG is it.

- **Title block**: the Project's name as the title (Inter 700 22, `ink`), "by {Maker's name}" under it (Instrument Serif italic 13, `muted`), then one tech line (DM Mono `muted`: technique, Bead, grid, Estimated size). An empty name leaves out the title, an empty maker the "by" line; the Bead's name is never the title.
- **The whole Schema on the board**: rulers on all four sides with a number every 5, or 10 when the beads are small (every 10th and the 1 in `ink` 500, the others `muted`) and a hairline every 10. A small Schema's bead is capped at `print-bead-max` (6 mm) and the picture is centred in its area, Beads needed moving up under it at an even gap; a big Schema is scaled down to fit with no minimum bead size; a wide flat one fits the page width.
- **The chart parts** are marked on it in the PDF only: solid 2 px `accent` lines with a white keyline, run through the rulers, with "101 →" and "101 ↓" in `accent-strong` where each cut is, and a white pill with an `accent` border on each part: "part A · page 2", "B · p 3".
- **Beads needed** under the board, in two columns that read down: a letter swatch (the color, its Swatch letter on it when Letters is on), color name, beads, grams; then the Total ("Total · 14 colors · 16 900 beads · ≈ 84.5 g") and the grams note. It takes at most 40% of the room under the title block.
- **List pages**: colors that do not fit go on pages that follow, in the PDF right after the cover (so chart pages start later) and in the PNG as `_2`, `_3` files after the Project's name. Each has the Project's name, small, and the same two columns; the Total and the grams note end the last. The full legend, with codes and what to buy, stays on the Specification.
- **Footer**: the X1 mark and "openbeads" on the left, date and time on the right.

## Chart pages

- **Parts as big as a chart page holds**, cut from the top left. Every bead is `print-chart-cell` (3 mm), so a weaver can follow it and what is counted on one page matches the next. A part is as many beads across and down as fit the chart area at that size, its rulers and overlap included: 60 across, and 75 down with a two-row color key (the key's height is set once per PDF from the page with the most colors). The last part in each direction holds what remains, so a 100 × 100 is 2 × 2 parts and a 35 × 120 is 1 × 2. Exact layout: the PrintChartPage card.
- **Leftover parts share a sheet** when they fit at that size, each on its own outlined pad with its label above it ("part B · columns 101–130 · rows 1–100"), 6 mm apart; a long strip (a bracelet) stacks its parts the same way. Sheets are filled in reading order.
- **Vector**: chart pages are PDF drawing (ADR 0043): fills, lines, Swatch letters and ruler numbers in the PDF's built-in Helvetica, sharp at any zoom. The translated text (header, part label, key names, footer) is one 300 dpi picture under the drawing.
- **Rulers count in fives**: upright numbers at every 5th row and column (the Schema's own: 65, 70… on a part from 61) on all four sides, in a `print-ruler` band; tens Helvetica-Bold `ink`, fives Helvetica `muted`, `print-letter` (6.5 pt). **Lines**: between cells `print-line-cell` in `line-strong`, every 5th `print-line-five` in `field-line`, every 10th and the edge `print-line-ten` in `ink`.
- **Overlap**: a part repeats `print-part-overlap` (2) columns or rows of the part before it, tinted (`print-overlap-tint`, 60% toward white; letters `muted`, numbers `faint`), with a `print-overlap-line` (0.5 mm) `accent` line where the part itself begins, through the rulers. The overlap counts in the size of a part, so a part always fits its sheet.
- **Letters always**: every bead carries its Swatch letter, whatever the Letters toggle says and in every Technique: Helvetica-Bold 6.5 pt, `ink` on a bead lighter than luminance 0.1791 and white on a darker one. An empty position is plain paper, no fill and no letter; a White bead is filled and lettered, which tells it from empty.
- **Header**: the technique word and name; the part label ("part A · columns 1–60 · rows 1–75 · by {maker}"); on the right a mini map of the parts (the current one in `accent`) and the page number, large. No chart-style or date line. **Under the board**: "Colors on this page", each a swatch drawn as a bead with its letter and the color name, no counts, in `print-key-columns` (6) columns. **Footer**: the mark, the brand and the date and time, and "Continues right on page 3, below on page 4 →" or "Last part" (writing.md).

## Specification

- The full **Beads needed** table: letter, swatch, color name, brand code, beads, grams, to buy; a Total row with the beads, the grams and the tubes; the grams note.
- **To buy**: tubes of 5 g, from the grams with about 10% spare, rounded up ("2 × 5 g"); the Total adds up the tubes.
- **The Schema**: made by, technique, bead, shape, size, finished size, beads and grams, chart style, pages.
- **Where each part is**: a small map of the parts with their pages, and a line on the part size, the shared sheets and the overlap.

## Word chart

- With Letters on, one or more pages of written rows follow the Specification (format: ticket 0574 and the glossary's Word chart; PDF only, no PNG). Each page is titled with its own rows ("Row by row 56–79"). An outlined strip with the color key sits at the top; each row is one line at `print-word-row` (10 pt), `print-word-pitch` apart: a tick box, the row number in DM Mono 500 and its runs, a hairline under it (stronger every 5th). When the longest row fits half the width the page runs in two columns of 91 mm with a `print-word-gap` gutter and no rule. A long row wraps with a hanging indent and never splits across columns or pages. Exact layout: the PrintWordChart card.

## Beads and grams

- **Beads and grams, side by side**: every color and the Total show the count and the weight, because beads are bought by the gram. The Total and the PNG say it both ways ("16 900 beads · ≈ 84.5 g").
- **How grams are worked out**: count ÷ the Bead's beads per gram, rounded **up** to 0.1 g, trailing ".0" dropped ("24 g", "3.9 g"); the Total is rounded up from the total count, not added up from the rounded rows.
- **Beads per gram is a catalog field** on each Bead: Miyuki Delica 11/0 about 200, TOHO Round 11/0 about 110–120 (published conversion charts); TOHO Cube 1.5 mm needs a weighed figure before it ships.
- A note under the Total says where the number comes from and suggests a spare: "≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares." An unknown Bead shows no grams, no tubes and no note.
- The Beads needed box in the app has the same grams column, so the screen and the paper agree.

## The maker's name

- **Where the name comes from**: the Project's own optional field, **Your name** (ADR 0060; "Printed on this Project's PDF and PNG exports.").
- Set on a Project, it is printed on every export of that Project as information: "made by" in the Specification, in the chart page header, and "by {maker}" under the title of the Cover page. It is never a watermark.
- Empty: the exports leave it out. Names longer than 32 characters are cut with an ellipsis in the header.

## Wide and long Schemas

- The PDF's chart pages are vector; its other pages (Cover, list pages, Specification, Word chart) are lossless pictures at `print-dpi` (300), or 150 where a device cannot allocate a 300 dpi page. Export quality sets the PNG only (QualitySlider card, ADR 0076). The PDF is always A4 portrait. A Schema wider than tall gets a shorter picture on the Cover page, which leaves more room for Beads needed; the chart pages are the same full-page parts.
- Long thin Schemas (bracelets) stack their parts on shared sheets (Chart pages above). See the PrintWide and PrintStrips cards.

## PNG image

- **The Cover page, alone**: the same A4 portrait page as the PDF's first (above), drawn at 150, 300 or 450 DPI by the Export quality (QualitySlider card); a device that cannot hold a 450 DPI page draws High at 300. The lines and pills that point at chart pages are left out, the PNG having no pages.
- Beads needed that does not fit continues in further files, `_2`, `_3` after the Project's name, handed over in order after the cover. Drawn in the app's language. No watermark. File names stay `bd-beads-{pattern}.png` and `.pdf`.

The sizes are the `print-*` tokens; the board color is `print-board`. The PrintPage1 (the Cover page), PrintChartPage, PrintSpecification, PrintWordChart and PngExport cards show the pages. The signed-off canvas is in the claude.ai design project "Export sheets — PDF & PNG".
