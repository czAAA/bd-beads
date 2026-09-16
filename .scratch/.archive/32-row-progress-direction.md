# 32: Turn the Row progress direction between the grid's rows and its columns

**What to build:** A new icon button in the Row progress card that flips which way the weaver's rows run across the grid: along the grid's rows (the default, today's behavior) or down its columns. It exists because Rotate (ticket 28) only turns the picture: after rotating a Pattern to vertical, the grid's rows stand upright on screen, so Row progress kept dimming vertical stripes instead of the rows the weaver now sees across the screen. The user asked for a separate button rather than tying this to Rotate, so the two stay independent: Rotate never changes the progress direction, and flipping the direction never rotates the picture.

**Blocked by:** None (can start immediately)

**Status:** done

**Decisions (2026-09-16):**
- Each direction keeps its own saved pointer. Flipping to columns and back returns to the same row, so an accidental click never loses the weaver's place.
- Peyote/Brick shift every other row by half a bead, so a grid column zigzags. Progress down the columns is tracked bead by bead, so its dimming and current-row marker follow that zigzag.
- Tests go at three seams: the domain functions in `pattern.ts`, `PatternGrid` (which beads are dimmed and marked), and `App` (clicking through the card).

- [ ] A direction icon button sits in the Row progress card, with a `title` + `aria-label` tooltip in English and Russian, `aria-pressed` while rows run down the columns, and a glyph unlike every other icon in the strip
- [ ] While rows run down the columns, the readout counts columns (`Row 3 / 10` on a 10-column × 20-row Pattern), and Previous/Row done step through the columns, stopping at the first and last one
- [ ] While rows run down the columns, the beads in columns before the pointer are dimmed and the current column is outlined; no whole grid row carries the row overlay
- [ ] Rows and columns each remember their own pointer: flipping the direction and back restores the row the weaver was on
- [ ] The direction and both pointers persist with the Pattern (localStorage and exported files), and Patterns saved before this ticket open with rows running along the grid's rows
- [ ] Flipping the direction is not an undo step, never touches the grid, and never changes the Rotate view flag (and rotating never changes the direction)
- [ ] The Row progress card always stays one line (toggles, readout, steps), in English and Russian, whichever direction is on; when the strip runs short, the whole card moves to the strip's next line instead of wrapping inside
- [ ] The existing Row progress behavior along the grid's rows is unchanged
