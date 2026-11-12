# Printed output

The PDF and PNG exports of a framed Schema: the chart is the main thing on every page, every bead countable, with the facts and the beads to buy set clearly around it. Signed off in the design session of 2026-10-26 (ticket 0575, "Gallery").

## Look and feel

- **The chart comes first.** Page 1 shows the whole piece across the full width of the sheet, as the working chart when it fits there and as the overview of its parts when it does not; every chart page shows one part with every row and column numbered. Everything else is small and sits around the board, so the page works at the craft table.
- **The canvas, on paper.** On the overview and the PNG's Cover page the Schema sits on a pale rounded board (`print-board`) like the app's canvas. A chart, on page 1 or a chart page, has no board fill, only a thin rounded outline (`print-pad-line`, `print-pad-radius`), so only beads take toner. The technique word is set in Instrument Serif italic in `accent` next to the title (the Frame's name, else the Project's).
- **Open, with no watermarks.** Nothing is drawn behind or over the chart or the text: no background maker's name, no X1 marks, no accent line, no signature on the beads. The PDF and PNG are meant to be shared. The maker's name is still printed as information (Made by, the header, "by {maker}").
- **Accent marks structure only**: the technique word, the lines where the chart parts meet, the part labels and the current part on the mini map. Text is `ink` or `muted`. A black-and-white printer turns the accent gray and loses no information: every bead on a chart page carries its letter.
- **On every page**: the X1 mark and "openbeads" (small, in the header or footer, never as a background), technique and name, the maker's name, the export date and time, "page 2 / 9".
- Inter for text, DM Mono for numbers and meta, Instrument Serif italic for the technique word and the maker's name, loaded before drawing. A4 portrait, 10 mm margins (`print-margin`); nothing under 6.5 pt but a chart bead's Swatch letter, which scales with the bead; Row progress fades never print.

## The order of the pages

1. **Page 1** (ticket 0914): the title block, the whole piece and Beads needed. When the chart fits there at a working bead it is the chart itself, and for most pieces (up to about 100 × 100, a bracelet in strips) **the PDF ends here**: a 20 × 20 is 1 page, not 3. Beads needed that does not fit continues on **list pages** straight after it.
2. **Chart pages**, only when the chart does not fit page 1: the parts, in reading order (across, then down), after the overview on page 1.
3. **Word chart** pages, only when Letters is on (ticket 0574).

There is no Cover that repeats the chart and no Specification that repeats the bead list (ticket 0914): Beads needed is one table, printed once, and the Schema's facts are page 1's tech line.

## Page 1

One A4 portrait page inside a 10 mm margin on all four sides (`print-margin`), the PrintPage1 card.

- **Title block**: the Frame's name as the title, else the Project's (Inter 700 22, `ink`), "by {Maker's name}" under it (Instrument Serif italic 13, `muted`), then one tech line (DM Mono `muted`: technique, grid, Bead, Estimated size). An empty name leaves out the title, an empty maker the "by" line; the Bead's name is never the title.
- **The chart, whole** (it fits page 1): drawn as a chart page draws a part (Chart pages below), PDF drawing with a letter on every bead, rulers on all four sides and the lines every 5 and 10, at the bead the plan gives (ticket 0913): as big as page 1 allows up to `print-bead-max` (9 mm), down to `print-bead-stretch` (1.6 mm) only to keep it there. A small piece fills the page width, so a page is never mostly empty: a 20 × 20 at 9 mm; a 5 × 5 is centred at 9 mm. A long narrow piece is folded into strips side by side, each under its label (PrintStrips). Page 1 leaves the chart the room under the title block and over Beads needed: all of Beads needed when it takes no more than 40% of the page under the title block, else its heading and first row, the rest of the colors going under the chart as they fit and on list pages.
- **The overview** (it does not fit): the whole piece on the board, scaled to the room it has with no minimum bead, without letters, rulers with a number every 5 (10 when the beads are small) and a hairline every 10, an empty position bare board under a small `faint` cross. The chart parts are marked on it: solid 2 px `accent` lines with a white keyline, run through the rulers, with "101 →" and "101 ↓" in `accent-strong` where each cut is, and a white pill with an `accent` border on each part: "part A · page 2", "B · p 3". Beads needed takes at most 40% of the room under the title block.
- **Beads needed**, one table: the heading over a 1.5 px `ink` rule, then two columns that read down, each with its heads (DM Mono 6.5 `muted`: color, code, beads, grams, to buy) and its rows on `line` hairlines: a letter swatch (the color with its Swatch letter, as every chart prints it), color name, brand code, beads, grams, to buy. Under a 1.5 px rule the Total ("Total · 8 colors" on the left; "10 000 beads · ≈ 50 g · 15 × 5 g" on the right) and the grams note.
- **To buy**: tubes of 5 g, from the grams with about 10% spare, rounded up ("2 × 5 g"); the Total adds up the tubes. An unknown Bead shows no grams, no tubes and no note.
- **List pages**: colors that do not fit go on pages straight after page 1 (so chart pages start later), each with the title, small, and the same table; the Total and the grams note end the last.
- **Footer**: the X1 mark, "openbeads" and the date and time on the left, the page number on the right ("1 / 1", "1 / 3"), on page 1 and the list pages.

## Chart pages

- **The bead is as big as the sheet allows** (ticket 0913), the same on every chart page of a PDF. The whole Schema is the chart on page 1 when it fits there at `print-bead-stretch` (1.6 mm) or more (ticket 0914); 1.6 to 1.8 mm is used only for that. Up to about 100 × 100 fits page 1. A small Schema fills the width up to `print-bead-max` (9 mm), and one too narrow to fill it at 9 mm is centred.
- **Otherwise equal parts**: the fewest sheets that keep the bead at `print-bead-min` (1.8 mm) or more, then the largest bead those sheets allow, at most 3 mm. A 150 × 100 is two parts of 75 columns at about 2.3 mm, not 100 + 50; a 150 × 150 is four parts. Cuts fall on a multiple of 10 where the parts still fit at that bead on as many sheets. With more than 26 colors (two-letter Swatch letters) the floor is 2.2 mm and there is no stretch. Every part fits the chart area with its rulers and overlap, under a color key whose height is set once per PDF from the page with the most colors. Exact layout: the PrintChartPage card.
- **Parts share a sheet** when they fit at that bead, each on its own outlined pad with its label above it ("part B · columns 101–130 · rows 1–100"), 6 mm apart; a long narrow Schema under 3 mm a bead whole (a bracelet) is folded into strips side by side on page 1 when that gives a bigger bead: a 35 × 120 is two strips at about 2.2 mm (PrintStrips card). Sheets are filled in reading order.
- **Vector**: chart pages, and the chart on page 1, are PDF drawing (ADR 0043): fills, lines, Swatch letters and ruler numbers in the PDF's built-in Helvetica, sharp at any zoom. The translated text (header, part label, key names, footer; page 1's title block and Beads needed) is one 300 dpi picture under the drawing.
- **Rulers count in fives**, or in tens under 2.2 mm a bead: upright numbers at every 5th row and column (the Schema's own: 65, 70… on a part from 61) on all four sides, in a `print-ruler` band; tens Helvetica-Bold `ink`, fives Helvetica `muted`, `print-letter` (6.5 pt). **Lines**: between cells `print-line-cell` in `line-strong`, every 5th `print-line-five` in `field-line`, every 10th and the edge `print-line-ten` in `ink`.
- **Overlap**: a part repeats `print-part-overlap` (2) columns or rows of the part before it, tinted (`print-overlap-tint`, 60% toward white; letters `muted`, numbers `faint`), with a `print-overlap-line` (0.5 mm) `accent` line where the part itself begins, through the rulers. The overlap counts in the size of a part, so a part always fits its sheet.
- **Letters always**: every bead carries its Swatch letter, whatever the Letters toggle says and in every Technique: Helvetica-Bold, 6.5 pt on a 3 mm bead and scaled with it (about 4.3 pt at 1.8 mm), never wider than its cell; `ink` on a bead lighter than luminance 0.1791 and white on a darker one. An empty position is plain paper under a small `faint` cross (ticket 0818), no fill and no letter; a White bead is filled and lettered, which tells it from empty.
- **Header**: the technique word and name; the part label ("part A · columns 1–60 · rows 1–75 · by {maker}"); on the right a mini map of the parts (the current one in `accent`) and the page number, large. No chart-style or date line. **Under the board**: "Colors on this page", each a swatch drawn as a bead with its letter and the color name, no counts, in `print-key-columns` (6) columns. **Footer**: the mark, the brand and the date and time, and "Continues right on page 3, below on page 4 →" or "Last part" (writing.md).

## Word chart

- With Letters on, one or more pages of written rows follow the chart (format: ticket 0574 and the glossary's Word chart; PDF only, no PNG). Each page is titled with its own rows ("Row by row 56–79"). An outlined strip with the color key sits at the top; each row is one line at `print-word-row` (10 pt), `print-word-pitch` apart: a tick box, the row number in DM Mono 500 and its runs, a hairline under it (stronger every 5th). When the longest row fits half the width the page runs in two columns of 91 mm with a `print-word-gap` gutter and no rule. A long row wraps with a hanging indent and never splits across columns or pages. Exact layout: the PrintWordChart card.

## Beads and grams

- **Beads and grams, side by side**: every color and the Total show the count and the weight, because beads are bought by the gram. The Total and the PNG say it both ways ("16 900 beads · ≈ 84.5 g").
- **How grams are worked out**: count ÷ the Bead's beads per gram, rounded **up** to 0.1 g, trailing ".0" dropped ("24 g", "3.9 g"); the Total is rounded up from the total count, not added up from the rounded rows.
- **Beads per gram is a catalog field** on each Bead: Miyuki Delica 11/0 about 200, TOHO Round 11/0 about 105 (TOHO's Beads Per Kg Chart, 105,300 a kg); TOHO Cube 1.5 mm needs a weighed figure before it ships.
- A note under the Total says where the number comes from and suggests a spare: "≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares." An unknown Bead shows no grams, no tubes and no note.
- The Beads needed box in the app has the same grams column, so the screen and the paper agree.

## The maker's name

- **Where the name comes from**: the Project's own optional field, **Your name** (ADR 0060; "Printed on this Project's PDF and PNG exports.").
- Set on a Project, it is printed on every export of that Project as information: in the chart page header, and "by {maker}" under the title of page 1 and the Cover page. It is never a watermark.
- Empty: the exports leave it out. Names longer than 32 characters are cut with an ellipsis in the header.

## Wide and long Schemas

- The PDF's charts are vector; its other pages (the overview, list pages, Word chart) and the text under a chart are lossless pictures at 300 dpi (`print-dpi`), or 150 where a device cannot allocate a 300 dpi page. Export quality sets the PNG only (QualitySlider card, ADR 0076). The PDF is always A4 portrait. A Schema wider than tall gets a shorter chart on page 1, which leaves more room for Beads needed; the chart pages are the same full-page parts.
- Long thin Schemas (bracelets) stack their parts on shared sheets (Chart pages above). See the PrintWide and PrintStrips cards.

## PNG image

- **The Cover page, alone**: one A4 portrait page with page 1's title block, the whole Schema on the board (its bead capped at `print-cover-bead-max`, 6 mm; letters only with Letters on) Beads needed in two columns of swatch, name, beads and grams, and a footer with the date and time on the right, drawn at 150, 300 or 450 DPI by the Export quality (QualitySlider card); a device that cannot hold a 450 DPI page draws High at 300. Page 1 of the PDF replaced it there in ticket 0914; the PNG becomes page 1 as a picture in ticket 0915.
- Beads needed that does not fit continues in further files, `_2`, `_3` after the file name, handed over in order after the cover. Drawn in the app's language. No watermark. The PNG and PDF are named `{project}-{frame}-{maker}.png|pdf` and the project file `{project}-{maker}.openbeads`, each part made filename-safe and left out when it leaves nothing to write (ticket 0720).

The sizes are the `print-*` tokens; the board color is `print-board`. The PrintPage1, PrintChartPage, PrintStrips, PrintWordChart and PngExport cards show the pages. The signed-off canvas is in the claude.ai design project "Export sheets — PDF & PNG".
