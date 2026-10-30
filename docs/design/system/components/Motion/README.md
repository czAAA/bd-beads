# Motion

How things move: four durations, three easings, and the rules that keep motion off the Pattern; the buttons in the preview play each motion.

- `--duration-instant` 80ms (press, bead hover), `--duration-fast` 120ms (hover, colour, tooltips), `--duration-base` 200ms (menus, popovers, toasts, modals, disclosure rows, the row marker; leaving 150ms), `--duration-slow` 280ms (sheets and the Drawer arriving; leaving 200ms).
- `--ease-out` for arriving, `--ease-in` for leaving, `--ease-standard` for moving. No bounce, no overshoot.
- Only `transform` and `opacity` animate over the canvas; the drawing surface never resizes during an animation (ADR 0018). Height animates only inside the left column.
- Row done is the one motion on the Pattern: the marker glides to the next pass (200ms), the finished pass glints bead by bead in the Row direction, and a spark rides the track's edge. The press that marks the last pass plays Pattern done once: a silver firework, a shimmer that brings the finished passes back to full color, and twinkling stars (ticket 0729; every value in the Motion section's Row progress part). Painting, the theme switch and zoom steps are instant.
- Toasts leave after 5s unless hovered or focused; errors stay.
- Reduced motion: sheets, menus and modals fade in 120ms instead of sliding; the marker and the ruler pill jump; no glint, spark flare or Pattern done; loading beads stand still.

Hand-written from the Phase B sign-off; the tokens and classes live in `components/bundle.css`.

- **Menu and Project (spec 0440):** the dropdown fades in over `duration-base` with a 4px move and out in 150ms, on every screen size. Under reduced motion it only fades.

## As built (ticket 0730)

- Row done and Pattern done are built as the Motion section's Row progress part says, with its own As built note: the press is the trigger, the canvas runs a frame loop only while something moves, and Pattern done lasts until its last star (3.2s from its start).
