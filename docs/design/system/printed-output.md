# Printed output

The PDF and PNG exports: the chart is the main thing on every page, large and ready to work from, with the canvas look kept light around it.

## Look and feel

- **The chart comes first.** On every page the board with the beads, the rulers and the 10-bead lines takes most of the sheet; everything else is small and sits in the margins, so the page works at the craft table.
- **The canvas, on paper.** The chart sits on a pale rounded board (#f7f3ec) like the app's canvas; the technique word is set in Instrument Serif italic in `accent` next to the Pattern name.
- **The accent line is background**: a soft curve in at the bottom left, under the maker's name, then it slips under the canvas at its bottom-right corner and comes out again at its top-right corner to leave off the page. It passes behind the canvas, never over the beads, Beads needed or the facts. 0.5 mm at 38%.
- **The maker's name** sits under the canvas, large and pale in Instrument Serif italic, its top tucked behind the board's lower edge. **The X1 mark** appears three times at three sizes, and never touches the name.
- **Accent stays light**: the technique word at full strength; the line at 50%, the marks at 7–10%, the name at 10–14%. Text is `ink` or `muted`. A black-and-white printer turns the accent gray and loses no information.
- **On every page**: the X1 mark and "bd-beads", technique and name, the maker's name, the export date and time, "Page 2 of 5".
- Inter for text, DM Mono for numbers and meta, Instrument Serif italic for the technique word and the maker's name, loaded before drawing. A4 portrait, 150 dpi, 10 mm margins; nothing under 6.5 pt; Row progress fades never print.

## Page 1

- **The whole Pattern, large**: page 1 shows the full canvas as big as the sheet allows, with rulers every 10 and the 10-bead lines; the chart parts are dashed on it and numbered by page.
- **A narrow column on the right** (48 mm): Beads needed with bead-shaped swatches, names, **beads and grams** per color and in the Total, a note on how the grams are worked out, then Made by, Technique, Bead, Size and Estimated size. A Pattern wider than tall puts this column under the canvas.
- Above the canvas: the brand on the left, the maker's name, date and time on the right; the technique word and name; one meta line; one line on reading the parts. Under it the maker's name, tucked behind the board, with the accent line running below.

## Chart pages

- **Every part fills its page, the last one too.** The Pattern is split into equal parts (2×2 for 60×80: 30×40 beads each), then the bead grows until a part fills the sheet: here 5.6 mm, the same on every page, never above 7 mm. Only the page count is set by the 4.6 mm base size.
- Rulers on all four sides in the Pattern's own numbers (every 5th in `muted`, every 10th bold) and a hairline every 10 beads.
- **A 16 mm header**: technique word and name, the part, the maker's name, date and time, the page number and a mini map. **An 8 mm footer**: the brand, and where the chart continues ("Continues right on page 3, below on page 4 →", or "Last part").
- A 12 mm band under the board holds the maker's name (centred, tucked behind the board) and the accent line's run to the right.

## Beads and grams

- **Beads and grams, side by side**: every color and the Total show the count and the weight, because beads are bought by the gram. The line under the title and the PNG say the total both ways ("4 800 beads · ≈ 24 g").
- **How grams are worked out**: count ÷ the Bead's beads per gram, rounded **up** to 0.1 g, trailing ".0" dropped ("24 g", "3.9 g"); the Total is rounded up from the total count, not added up from the rounded rows.
- **Beads per gram is a new catalog field** on each Bead: Miyuki Delica 11/0 about 200, TOHO Round 11/0 about 110–120 (published conversion charts); TOHO Cube 1.5 mm needs a weighed figure before it ships.
- A note under the Total says where the number comes from and suggests a spare: "≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares." An unknown Bead shows no grams and no note.
- The Beads needed box in the app gets the same grams column, so the screen and the paper agree.

## The maker's name

- **Where the name comes from**: a new optional field, **Your name**, set from the last row of the Export ▾ menu (More on the phone), kept on the device like the theme ("Printed on your PDF and PNG exports. Stays on this device."). The app has no accounts, so nothing leaves the device.
- Set once, it goes on every export: in the header, as "Made by" on page 1, as "by …" on the PNG, and large and pale in the background.
- Empty: the exports simply leave it out, background included. Names longer than 32 characters are cut with an ellipsis in the header; the background name is never cut, it runs off the page.

## Wide and long Patterns

- A Pattern wider than tall prints on **landscape** A4 with the same layout; taller or square prints portrait.
- When a part would fill less than half the page (bracelets), several parts stack on one sheet, each on its own board with rulers and a label "Part 2 · columns 39–76". The bead stays at the base size.
- The PNG of a wide Pattern puts the story under the chart. See the PrintWide and PrintStrips cards.

## PNG image

- **The chart first**: the whole Pattern on its board with rulers every 10 and the 10-bead lines takes about three quarters of the picture.
- A narrow story column on the right: technique word, name, "by {maker}", bead and size, Beads needed with beads and grams and the Total, date and time, the X1 mark and "bd-beads". A Pattern wider than tall puts it underneath. The maker's name sits under the board; the accent line curves under it and slips behind the board's corners; three marks behind; nothing over the beads or the text.
- Beads are 30 px (fewer when the picture would pass 16 megapixels); drawn in the app's language. File names stay `bd-beads-{pattern}.png` and `.pdf`.

The sizes are the `print-*` tokens; the board color is `print-board`. The PrintPage1, PrintChartPage and PngExport cards show the pages.
