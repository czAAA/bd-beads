# The Palette is no longer fixed: used Custom colors join it

**Status: accepted.** Amends [ADR 0002](0002-palette-separate-from-bead-catalog.md) (the Palette stays separate from the bead catalog) only in that the Palette's contents are no longer a constant.

## Context

The Palette was twelve built-in colors; a Custom color was a one-off that vanished when the next one was chosen, so a color the maker liked had to be re-picked by hand every time.

## Decision

- The first time a Custom color paints a cell it is appended to the Palette, after the built-in colors and any colors added before it. Choosing a color without painting adds nothing; a hex already in the Palette is never added twice (it selects the existing swatch).
- At most 28 can be added (40 swatches in all). Past that a new Custom color still paints, is not added, and the user is told once.
- Added colors are kept on the device (`bd-beads:added-colors`, like the theme and the maker name, [ADR 0001](0001-local-only-persistence.md)), not inside a Pattern. Cells store the hex, so a Pattern opens correctly on a device without the swatches.
- An added swatch can be removed (ticket 228): by the × on the selected one, or Delete or Backspace on a focused one. Cells keep their hex, so nothing painted changes; removing the active swatch selects the default color; an Undo toast restores it in place. The built-in colors cannot be removed.
- Added swatches have no keyboard shortcut; the shortcuts stay on the twelve built-in colors.
- The Palette is read through a provided reactive list (`usePalette`) rather than the `PALETTE` constant, which now means the built-in colors only.

## Consequences

The Colors group wraps onto more rows. Removing an added color is a separate ticket (228).
