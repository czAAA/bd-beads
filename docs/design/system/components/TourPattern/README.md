# TourPattern

The finished Pattern every Tour builds: 10 columns × 75 rows, loom, the default Bead, Palette Yellow #f2c94c and Black #1a1a1a only; five gold rhombuses with a black eye on black, like a Belarusian rushnik band.

- **Design:** black ground; rhombuses 10 wide × 11 tall at rows 3, 18, 33, 48 and 63, each solid gold with a black ring and a 2-bead black centre; between them, four rows of small gold beads; the four corners empty. Counts: Yellow 294, Black 452, empty 4.
- **Steps:** 2 Fill black; 3 Paint the 22-bead outline of the first rhombus in yellow; 4 Fill inside it (Fill spreads to the four side neighbours, not diagonally, so the outline holds); 5 Paint the 16-bead eye in black; 6 Select rows 3–13, Copy, paste at rows 18, 33, 48 and 63; 7 the Tour adds the 28 beads between rhombuses and at the corners in one Undo step, leaving row 1, column 1 yellow; 8 Erase row 1, column 1.
- **Data:** the cell map is in the preview and in `components/TourPattern/tour-pattern.json` (`rows`: 75 strings of 10, `Y` yellow, `K` black, `.` empty; `marks` for steps 3, 5, 6 and 8; `counts`). Rows and columns count from 1.
- **Dark theme:** the black ground blends into the dark board; the gold rhombuses carry the design.

Hand-written from the v15 sign-off.
