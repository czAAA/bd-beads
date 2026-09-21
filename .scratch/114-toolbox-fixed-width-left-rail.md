# 114: Toolbox becomes a fixed-width, sticky left rail

**What to build:** While a Pattern is open, the Toolbox moves from the strip above the canvas to a narrow rail on the left side of the app shell, stacking its Tool groups vertically. The rail has a fixed width: no wider than 200px on large displays, and thinner still on iPad-sized viewports (both named sizes in ticket 79: 8″ and 10–14″), with every control still reachable and tappable there.

The rail shares the left column with the New Pattern form: the form shows when no Pattern is open or during a Convert image framing step, the rail shows otherwise (the same either/or the left panel already has, so no new state). The above-canvas panel goes away and the canvas panel takes the full width to the right of the column.

The rail stays pinned near the top of the viewport while the canvas is in view, so it stays reachable while working on the lower rows of a tall Pattern, and un-pins once the canvas has scrolled past, as the Toolbox does today.

The Tool groups reflow to fit a narrow column: controls wrap at about four per row instead of seven, and the Colors group (Palette swatches, Custom color, Image colors), the Mirror counters, Size controls and Row progress readout all lay out inside the rail without horizontal scrolling or clipped controls. The "at most 14 controls in view, two rows of seven" rule and the hover-expand overflow are re-decided for the narrow column and the result recorded. Escape still collapses an expanded group before doing anything else.

Amends ADR 0004 and ADR 0005 (the Toolbox is no longer above the canvas) and CONTEXT.md's Toolbox, Tool group and App shell layout entries.

Overlaps ticket 79 (phone/tablet breakpoints) for the rail's tablet width; 79 keeps the rest of its scope (phone, and the shell as a whole). Drawing surface performance must not regress from the wider canvas panel (see the performance note on ticket 79/83, ADR 0018).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With a Pattern open, the Toolbox renders as a vertical rail on the left, no wider than 200px at large-display widths
- [ ] At iPad 8″ and iPad 10–14″ viewport widths the rail is narrower than at large-display widths, and all controls remain tappable
- [ ] The rail and the New Pattern form take turns in the left column: form with no Pattern open or while framing, rail otherwise
- [ ] The above-canvas panel is gone and the canvas panel uses the freed width
- [ ] The rail stays pinned while the canvas is in view and un-pins once the canvas has scrolled past
- [ ] Every Tool group (Tools, Colors, Edit, Mirror, Size, Row progress) fits the rail without horizontal scrolling or clipped controls, including a Pattern with Image colors
- [ ] The cap-and-expand behaviour of Tool groups is re-decided for the narrow column, and Escape still collapses an expanded group first
- [ ] Existing Toolbox behaviour is unchanged (tool selection, colors, undo/redo, rotate, copy, Mirror, Size/Resize, Row progress, Delete all, keyboard shortcuts)
- [ ] ADR 0004 and ADR 0005 amended; CONTEXT.md's Toolbox, Tool group and App shell layout entries updated
